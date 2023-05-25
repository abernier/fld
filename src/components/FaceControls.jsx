import * as THREE from "three";
import { useState, Suspense, useEffect, useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useVideoTexture } from "@react-three/drei";
import { easing } from "maath";

import { Facemesh } from "./Facemesh";
import { useFaceLandmarker } from "./FaceLandmarker";

const isFunction = (node) => typeof node === "function";

function mean(v1, v2) {
  return v1.add(v2).multiplyScalar(0.5);
}

const useVideoFrame = (video, f) => {
  // https://web.dev/requestvideoframecallback-rvfc/
  // https://www.remotion.dev/docs/video-manipulation
  useEffect(() => {
    if (!video || !video.requestVideoFrameCallback) return;
    let handle;
    function callback(...args) {
      f(...args);
      handle = video.requestVideoFrameCallback(callback);
    }
    video.requestVideoFrameCallback(callback);

    return () => video.cancelVideoFrameCallback(handle);
  }, [video, f]);
};

const Webcam = ({ children, ...props }) => {
  const [stream, setStream] = useState();

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          // width: 9999, // ask for max res
        },
      })
      .then((stream) => setStream(stream))
      .catch(console.error);
  }, []);

  return (
    <Suspense fallback={null}>
      <VideoMaterial src={stream}>{children}</VideoMaterial>
    </Suspense>
  );
};

const VideoMaterial = ({ src, children, ...props }) => {
  const [faces, setFaces] = useState();

  const texture = useVideoTexture(src);
  const video = texture.source.data;
  // console.log("video", video);

  const faceLandmarker = useFaceLandmarker();

  const onVideoFrame = useCallback(
    (time) => {
      const faces = faceLandmarker.detectForVideo(video, time);
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
  return (
    <>
      {/* <meshStandardMaterial map={texture} toneMapped={false} /> */}

      {functional ? children(faces, texture) : children}
    </>
  );
};

export const FaceControls = ({ camera, eyes = false, visible }) => {
  const defaultCamera = useThree((state) => state.camera);
  const explCamera = camera || defaultCamera;

  const facemeshApiRef = useRef();

  const [posTarget] = useState(() => new THREE.Vector3());
  const [posCurrent] = useState(() => new THREE.Vector3());
  const [lookAtTarget] = useState(() => new THREE.Vector3());
  const [lookAtCurrent] = useState(() => new THREE.Vector3());
  const [irisRightDirPos] = useState(() => new THREE.Vector3());
  const [irisLeftDirPos] = useState(() => new THREE.Vector3());
  const [irisRightLookAt] = useState(() => new THREE.Vector3());
  const [irisLeftLookAt] = useState(() => new THREE.Vector3());
  useFrame((_, delta) => {
    const facemeshApi = facemeshApiRef.current;

    if (explCamera && facemeshApi) {
      const { meshRef, eyeRightRef, eyeLeftRef } = facemeshApi;

      if (eyeRightRef.current && eyeLeftRef.current) {
        const { irisDirRef: irisRightDirRef } = eyeRightRef.current;
        const { irisDirRef: irisLeftDirRef } = eyeLeftRef.current;

        //
        // usercam pos: mean of irisRightDirPos,irisLeftDirPos
        //
        irisRightDirRef.current.getWorldPosition(irisRightDirPos);
        irisLeftDirRef.current.getWorldPosition(irisLeftDirPos);
        posTarget.copy(mean(irisRightDirPos, irisLeftDirPos));

        //
        // usercam lookAt: mean of irisRightLookAt,irisLeftLookAt
        //
        irisRightLookAt.copy(irisRightDirRef.current.localToWorld(new THREE.Vector3(0, 0, -1)));
        irisLeftLookAt.copy(irisLeftDirRef.current.localToWorld(new THREE.Vector3(0, 0, -1)));
        lookAtTarget.copy(mean(irisRightLookAt, irisLeftLookAt));
      } else {
        meshRef.current.getWorldPosition(posTarget);
        lookAtTarget.copy(meshRef.current.localToWorld(new THREE.Vector3(0, 0, -1)));
      }

      const eps = 0.000000001;

      easing.damp3(posCurrent, posTarget, 0.25, delta, undefined, undefined, eps);
      explCamera.position.copy(posCurrent);

      easing.damp3(lookAtCurrent, lookAtTarget, 0.25, delta, undefined, undefined, eps);
      explCamera.lookAt(lookAtCurrent);
    }
  });

  return (
    <>
      <Webcam>
        {(faces, texture) => {
          if (!faces) return;

          const points = faces?.faceLandmarks[0];

          return (
            <Facemesh
              position={explCamera.position}
              // lookAt={explCamera.lookAt}
              ref={facemeshApiRef}
              points={points}
              facialTransformationMatrix={faces.facialTransformationMatrixes[0]}
              faceBlendshapes={faces.faceBlendshapes[0]}
              depth={0.13}
              offset={true}
              offsetScalar={80}
              // origin={168}
              eyes={eyes}
              debug={true}
              rotation-z={Math.PI}
              visible={visible}
            >
              <meshStandardMaterial />
            </Facemesh>
          );
        }}
      </Webcam>
    </>
  );
};
