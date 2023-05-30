import * as THREE from "three";
import {
  useState,
  Suspense,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
  forwardRef,
  useMemo,
  useImperativeHandle,
  RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useVideoTexture } from "@react-three/drei";
import { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { easing } from "maath";

import { Facemesh, FacemeshApi, FacemeshProps } from "./Facemesh";
import { useFaceLandmarker } from "./FaceLandmarker";

const isFunction = (node: any) => typeof node === "function";

function mean(v1: THREE.Vector3, v2: THREE.Vector3) {
  return v1.clone().add(v2).multiplyScalar(0.5);
}

function localToLocal(objSrc: THREE.Object3D, v: THREE.Vector3, objDst: THREE.Object3D) {
  // see: https://discourse.threejs.org/t/object3d-localtolocal/51564
  const v_world = objSrc.localToWorld(v);
  return objDst.worldToLocal(v_world);
}

const useVideoFrame = (video: HTMLVideoElement, f: (...args: any) => any) => {
  // https://web.dev/requestvideoframecallback-rvfc/
  // https://www.remotion.dev/docs/video-manipulation
  useEffect(() => {
    if (!video || !video.requestVideoFrameCallback) return;
    let handle: number;
    function callback(...args: any) {
      f(...args);
      handle = video.requestVideoFrameCallback(callback);
    }
    video.requestVideoFrameCallback(callback);

    return () => video.cancelVideoFrameCallback(handle);
  }, [video, f]);
};

const Webcam = ({ children }: { children?: (faces: FaceLandmarkerResult | undefined) => ReactNode }) => {
  const [stream, setStream] = useState<MediaStream>();

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      })
      .then((stream) => setStream(stream))
      .catch(console.error);
  }, []);

  return (
    <Suspense fallback={null}>
      <VideoMaterial src={stream!}>{children}</VideoMaterial>
    </Suspense>
  );
};

const VideoMaterial = ({
  src,
  children,
}: {
  src: MediaStream;
  children?: (faces: FaceLandmarkerResult | undefined) => ReactNode | ReactNode;
}) => {
  const [faces, setFaces] = useState<FaceLandmarkerResult>();

  const texture = useVideoTexture(src);
  const video = texture.source.data;

  const faceLandmarker = useFaceLandmarker();

  const onVideoFrame = useCallback(
    (time: number) => {
      const faces = faceLandmarker?.detectForVideo(video, time);
      setFaces(faces);
    },
    [faceLandmarker, video]
  );
  useVideoFrame(video, onVideoFrame);

  // const clock = useThree((state) => state.clock);
  // useFrame(() => {
  //   const timestamp = clock.getElapsedTime() * 1000;
  //   const faces = faceLandmarker.detectForVideo(video, timestamp);
  //   // console.log("faces=", faces);
  //   setFaces(faces);
  // });

  const functional = isFunction(children);
  return <>{functional ? children?.(faces) : children}</>;
};

//
//
//

type FaceControlsProps = {
  /**  */
  camera: THREE.Camera;
  /**  */
  manual?: boolean;
  /**  */
  smoothTime?: number;
  /**  */
  offset?: boolean;
  /**  */
  offsetScalar?: number;
  /** */
  eyes?: boolean;
  /** */
  eyesAsOrigin?: boolean;
  /** */
  debug?: boolean;
  /** */
  facemesh?: FacemeshProps;
};

type FaceControlsApi = {
  update: (delta: number) => void;
  facemeshApiRef: RefObject<FacemeshApi>;
};

export const FaceControls = forwardRef<FaceControlsApi, FaceControlsProps>(
  (
    {
      camera,
      manual = false,
      smoothTime = 0.25,
      offset = true,
      offsetScalar = 80,
      eyes = false,
      eyesAsOrigin = true,
      depth = 0.15,
      debug = false,
      facemesh,
    },
    fref
  ) => {
    const scene = useThree((state) => state.scene);
    const defaultCamera = useThree((state) => state.camera);
    const explCamera = camera || defaultCamera;

    const facemeshApiRef = useRef<FacemeshApi>(null);

    //
    // Position and orient camera, according to <Facemesh>
    //
    //  1. 👀 either following the 2 eyes
    //  2. 👤 or just the head mesh
    //

    const [posTarget] = useState(() => new THREE.Vector3());
    const [posCurrent] = useState(() => new THREE.Vector3());
    const [lookAtTarget] = useState(() => new THREE.Vector3());
    const [lookAtCurrent] = useState(() => new THREE.Vector3());
    const [irisRightDirPos] = useState(() => new THREE.Vector3());
    const [irisLeftDirPos] = useState(() => new THREE.Vector3());
    const [irisRightLookAt] = useState(() => new THREE.Vector3());
    const [irisLeftLookAt] = useState(() => new THREE.Vector3());
    const update = useCallback(
      function (delta: number) {
        const facemeshApi = facemeshApiRef.current;

        if (explCamera && facemeshApi) {
          const { outerRef, eyeRightRef, eyeLeftRef } = facemeshApi;

          //
          // Compute posTarget and lookAtTarget
          //

          if (eyeRightRef.current && eyeLeftRef.current) {
            // 1. 👀

            const { irisDirRef: irisRightDirRef } = eyeRightRef.current;
            const { irisDirRef: irisLeftDirRef } = eyeLeftRef.current;

            if (irisRightDirRef.current && irisLeftDirRef.current && outerRef.current) {
              //
              // posTarget: mean of irisRightDirPos,irisLeftDirPos
              //
              irisRightDirPos.copy(localToLocal(irisRightDirRef.current, new THREE.Vector3(0, 0, 0), outerRef.current));
              irisLeftDirPos.copy(localToLocal(irisLeftDirRef.current, new THREE.Vector3(0, 0, 0), outerRef.current));
              posTarget.copy(
                localToLocal(outerRef.current, mean(irisRightDirPos, irisLeftDirPos), explCamera.parent || scene)
              );

              //
              // lookAt: mean of irisRightLookAt,irisLeftLookAt
              //
              irisRightLookAt.copy(
                localToLocal(irisRightDirRef.current, new THREE.Vector3(0, 0, -1), outerRef.current)
              );
              irisLeftLookAt.copy(localToLocal(irisLeftDirRef.current, new THREE.Vector3(0, 0, -1), outerRef.current));
              lookAtTarget.copy(outerRef.current.localToWorld(mean(irisRightLookAt, irisLeftLookAt)));
            }
          } else {
            // 2. 👤

            if (outerRef.current) {
              posTarget.copy(localToLocal(outerRef.current, new THREE.Vector3(0, 0, 0), explCamera.parent || scene));
              lookAtTarget.copy(outerRef.current.localToWorld(new THREE.Vector3(0, 0, -1)));
            }
          }

          // damping
          if (smoothTime > 0) {
            const eps = 0.000000001;
            easing.damp3(posCurrent, posTarget, smoothTime, delta, undefined, undefined, eps);
            easing.damp3(lookAtCurrent, lookAtTarget, smoothTime, delta, undefined, undefined, eps);
          } else {
            posCurrent.copy(posTarget);
            lookAtCurrent.copy(lookAtTarget);
          }

          explCamera.position.copy(posCurrent);
          explCamera.lookAt(lookAtCurrent);
        }
      },
      [
        explCamera,
        irisLeftDirPos,
        irisLeftLookAt,
        irisRightDirPos,
        irisRightLookAt,
        lookAtCurrent,
        lookAtTarget,
        posCurrent,
        posTarget,
        scene,
        smoothTime,
      ]
    );

    useFrame((_, delta) => {
      if (!manual) {
        update(delta);
      }
    });

    // Ref API
    const api = useMemo<FaceControlsApi>(
      () => ({
        facemeshApiRef,
        update,
      }),
      [update]
    );
    useImperativeHandle(fref, () => api, [api]);

    return (
      <>
        <Webcam>
          {(faces) => {
            if (!faces) return;

            const points = faces.faceLandmarks[0];
            const facialTransformationMatrix = faces.facialTransformationMatrixes?.[0];
            const faceBlendshapes = faces.faceBlendshapes?.[0];

            return (
              <Facemesh
                ref={facemeshApiRef}
                {...facemesh}
                points={points}
                depth={depth}
                facialTransformationMatrix={facialTransformationMatrix}
                faceBlendshapes={faceBlendshapes}
                eyes={eyes}
                eyesAsOrigin={eyesAsOrigin}
                offset={offset}
                offsetScalar={offsetScalar}
                debug={debug}
                rotation-z={Math.PI}
                visible={debug}
              >
                <meshStandardMaterial flatShading={true} side={THREE.DoubleSide} />
              </Facemesh>
            );
          }}
        </Webcam>
      </>
    );
  }
);
