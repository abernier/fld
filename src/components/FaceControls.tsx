import * as THREE from "three";
import {
  useState,
  Suspense,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useMemo,
  useImperativeHandle,
  RefObject,
  createContext,
  useContext,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useVideoTexture } from "@react-three/drei";
import { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { easing } from "maath";

import { Facemesh, FacemeshApi, FacemeshProps } from "./Facemesh";
import { useFaceLandmarker } from "./FaceLandmarker";

type VideoTextureSrc = Parameters<typeof useVideoTexture>[0]; // useVideoTexture 1st arg `src` type

function mean(v1: THREE.Vector3, v2: THREE.Vector3) {
  return v1.clone().add(v2).multiplyScalar(0.5);
}

function localToLocal(objSrc: THREE.Object3D, v: THREE.Vector3, objDst: THREE.Object3D) {
  // see: https://discourse.threejs.org/t/object3d-localtolocal/51564
  const v_world = objSrc.localToWorld(v);
  return objDst.worldToLocal(v_world);
}

//
//
//

type FaceControlsProps = {
  /**  */
  camera?: THREE.Camera;
  /** */
  autostart?: boolean;
  /** */
  webcam?: boolean;
  /**  */
  webcamVideoTextureSrc?: VideoTextureSrc;
  /**  */
  manualUpdate?: boolean;
  /**  */
  manualDetect?: boolean;
  /** */
  onVideoFrame?: (e: THREE.Event) => void;
  /** */
  makeDefault?: boolean;
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
  /**  */
  depth: number;
  /** */
  debug?: boolean;
  /** */
  facemesh?: FacemeshProps;
};

type FaceControlsApi = THREE.EventDispatcher & {
  detect: (video: HTMLVideoElement, time: number) => void;
  computeTarget: () => THREE.Object3D;
  update: (delta: number, target?: THREE.Object3D) => void;
  facemeshApiRef: RefObject<FacemeshApi>;
  webcamApiRef: RefObject<WebcamApi>;
};

const FaceControlsContext = createContext({} as FaceControlsApi);

export const FaceControls = forwardRef<FaceControlsApi, FaceControlsProps>(
  (
    {
      camera,
      autostart = true,
      webcam = true,
      webcamVideoTextureSrc,
      manualUpdate = false,
      manualDetect = false,
      onVideoFrame,
      smoothTime = 0.25,
      offset = true,
      offsetScalar = 80,
      eyes = false,
      eyesAsOrigin = true,
      depth = 0.15,
      debug = false,
      facemesh,
      makeDefault,
    },
    fref
  ) => {
    const scene = useThree((state) => state.scene);
    const defaultCamera = useThree((state) => state.camera);
    const set = useThree((state) => state.set);
    const get = useThree((state) => state.get);
    const explCamera = camera || defaultCamera;

    const webcamApiRef = useRef<WebcamApi>(null);

    const facemeshApiRef = useRef<FacemeshApi>(null);

    //
    // computeTarget()
    //
    // Compute `target` position and rotation for the camera (according to <Facemesh>)
    //
    //  1. 👀 either following the 2 eyes
    //  2. 👤 or just the head mesh
    //

    const [target] = useState(() => new THREE.Object3D());
    const [irisRightDirPos] = useState(() => new THREE.Vector3());
    const [irisLeftDirPos] = useState(() => new THREE.Vector3());
    const [irisRightLookAt] = useState(() => new THREE.Vector3());
    const [irisLeftLookAt] = useState(() => new THREE.Vector3());
    const computeTarget = useCallback<FaceControlsApi["computeTarget"]>(() => {
      // same parent as the camera
      target.parent = explCamera.parent;

      const facemeshApi = facemeshApiRef.current;
      if (facemeshApi) {
        const { outerRef, eyeRightRef, eyeLeftRef } = facemeshApi;

        if (eyeRightRef.current && eyeLeftRef.current) {
          // 1. 👀

          const { irisDirRef: irisRightDirRef } = eyeRightRef.current;
          const { irisDirRef: irisLeftDirRef } = eyeLeftRef.current;

          if (irisRightDirRef.current && irisLeftDirRef.current && outerRef.current) {
            //
            // position: mean of irisRightDirPos,irisLeftDirPos
            //
            irisRightDirPos.copy(localToLocal(irisRightDirRef.current, new THREE.Vector3(0, 0, 0), outerRef.current));
            irisLeftDirPos.copy(localToLocal(irisLeftDirRef.current, new THREE.Vector3(0, 0, 0), outerRef.current));
            target.position.copy(
              localToLocal(outerRef.current, mean(irisRightDirPos, irisLeftDirPos), explCamera.parent || scene)
            );

            //
            // lookAt: mean of irisRightLookAt,irisLeftLookAt
            //
            irisRightLookAt.copy(localToLocal(irisRightDirRef.current, new THREE.Vector3(0, 0, 1), outerRef.current));
            irisLeftLookAt.copy(localToLocal(irisLeftDirRef.current, new THREE.Vector3(0, 0, 1), outerRef.current));
            target.lookAt(outerRef.current.localToWorld(mean(irisRightLookAt, irisLeftLookAt)));
          }
        } else {
          // 2. 👤

          if (outerRef.current) {
            target.position.copy(
              localToLocal(outerRef.current, new THREE.Vector3(0, 0, 0), explCamera.parent || scene)
            );
            target.lookAt(outerRef.current.localToWorld(new THREE.Vector3(0, 0, 1)));
          }
        }
      }

      return target;
    }, [explCamera, irisLeftDirPos, irisLeftLookAt, irisRightDirPos, irisRightLookAt, scene, target]);

    //
    // update()
    //
    // Updating the camera `current` position and rotation, following `target`
    //

    const [current] = useState(() => new THREE.Object3D());
    const update = useCallback<FaceControlsApi["update"]>(
      function (delta, target) {
        if (explCamera) {
          target ??= computeTarget();

          if (smoothTime > 0) {
            // damping current
            const eps = 1e-9;
            easing.damp3(current.position, target.position, smoothTime, delta, undefined, undefined, eps);
            easing.dampE(current.rotation, target.rotation, smoothTime, delta, undefined, undefined, eps);
          } else {
            // instant
            current.position.copy(target.position);
            current.rotation.copy(target.rotation);
          }

          explCamera.position.copy(current.position);
          explCamera.rotation.copy(current.rotation);
        }
      },
      [explCamera, computeTarget, smoothTime, current.position, current.rotation]
    );

    //
    // detect()
    //

    const [faces, setFaces] = useState<FaceLandmarkerResult>();
    const faceLandmarker = useFaceLandmarker();
    const detect = useCallback<FaceControlsApi["detect"]>(
      (video, time) => {
        const faces = faceLandmarker?.detectForVideo(video, time);
        setFaces(faces);
      },
      [faceLandmarker]
    );

    useFrame((_, delta) => {
      if (!manualUpdate) {
        update(delta);
      }
    });

    // Ref API
    const api = useMemo<FaceControlsApi>(
      () =>
        Object.assign(Object.create(THREE.EventDispatcher.prototype), {
          detect,
          computeTarget,
          update,
          facemeshApiRef,
          webcamApiRef,
          // shorthands
          play: () => webcamApiRef.current?.videoTextureApiRef.current?.texture.source.data.play(),
          pause: () => webcamApiRef.current?.videoTextureApiRef.current?.texture.source.data.pause(),
        }),
      [detect, computeTarget, update]
    );
    useImperativeHandle(fref, () => api, [api]);

    //
    // events callbacks
    //

    useEffect(() => {
      const onVideoFrameCb = (e: THREE.Event) => {
        if (!manualDetect) detect(e.texture.source.data, e.time);
        if (onVideoFrame) onVideoFrame(e);
      };

      api.addEventListener("videoFrame", onVideoFrameCb);

      return () => {
        api.removeEventListener("videoFrame", onVideoFrameCb);
      };
    }, [api, detect, faceLandmarker, manualDetect, onVideoFrame]);

    // `controls` global state
    useEffect(() => {
      if (makeDefault) {
        const old = get().controls;
        set({ controls: api });
        return () => set({ controls: old });
      }
    }, [makeDefault, api, get, set]);

    const points = faces?.faceLandmarks[0];
    const facialTransformationMatrix = faces?.facialTransformationMatrixes?.[0];
    const faceBlendshapes = faces?.faceBlendshapes?.[0];
    return (
      <FaceControlsContext.Provider value={api}>
        {webcam && <Webcam ref={webcamApiRef} autostart={autostart} videoTextureSrc={webcamVideoTextureSrc} />}

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
      </FaceControlsContext.Provider>
    );
  }
);

export const useFaceControls = () => useContext(FaceControlsContext);

//
// Webcam
//

type WebcamApi = {
  videoTextureApiRef: RefObject<VideoTextureApi>;
};

type WebcamProps = {
  videoTextureSrc?: VideoTextureSrc;
  autostart?: boolean;
};

const Webcam = forwardRef<WebcamApi, WebcamProps>(({ videoTextureSrc, autostart = true }, fref) => {
  const [stream, setStream] = useState<MediaStream>();

  const videoTextureApiRef = useRef<VideoTextureApi>(null);

  const faceControls = useFaceControls();
  useEffect(() => {
    let strm: MediaStream;

    if (!videoTextureSrc) {
      navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: { facingMode: "user" },
        })
        .then((s) => {
          strm = s;
          faceControls.dispatchEvent({ type: "stream", stream: strm });
          setStream(strm);
        })
        .catch(console.error);
    }

    return () => strm?.getTracks().forEach((track) => track.stop());
  }, [faceControls, videoTextureSrc]);

  // ref-api
  const api = useMemo<WebcamApi>(
    () => ({
      videoTextureApiRef,
    }),
    []
  );
  useImperativeHandle(fref, () => api, [api]);

  return (
    <Suspense fallback={null}>
      <VideoTexture ref={videoTextureApiRef} src={videoTextureSrc || stream!} start={autostart} />
    </Suspense>
  );
});

//
// VideoTexture
//

type VideoTextureApi = { texture: THREE.VideoTexture };
type VideoTextureProps = { src: VideoTextureSrc; start: boolean };

const VideoTexture = forwardRef<VideoTextureApi, VideoTextureProps>(({ src, start }, fref) => {
  const texture = useVideoTexture(src, { start });
  const video = texture.source.data;

  const faceControls = useFaceControls();
  const onVideoFrame = useCallback(
    (time: number) => {
      faceControls.dispatchEvent({ type: "videoFrame", texture, time });
    },
    [texture, faceControls]
  );
  useVideoFrame(video, onVideoFrame);

  // ref-api
  const api = useMemo<VideoTextureApi>(
    () => ({
      texture,
    }),
    [texture]
  );
  useImperativeHandle(fref, () => api, [api]);

  return <></>;
});

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
