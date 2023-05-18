import * as THREE from "three";
import { memo, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Grid,
  AccumulativeShadows,
  RandomizedLight,
  Environment,
  CameraControls,
  PerspectiveCamera,
  useHelper,
} from "@react-three/drei";
import { useControls, button, folder } from "leva";
import { easing } from "maath";

import FaceLandmarksDetection from "./FaceLandmarksDetection";

import { Laptop } from "./Laptop";

export default function App() {
  return (
    <>
      <FaceLandmarksDetection>
        <Canvas shadows camera={{ position: [-0.6, 0.1, 0.6], near: 0.01 }}>
          <Scene />
        </Canvas>
      </FaceLandmarksDetection>
    </>
  );
}

function mean(v1, v2) {
  return v1.add(v2).multiplyScalar(0.5);
}

function damp3(current, target, delta) {
  easing.damp3(current, target, 1, delta, undefined, undefined, 0.000000001);
}

function Scene() {
  const [stream, setStream] = useState();

  const userConfig = useControls({
    camera: { value: "cc", options: ["user", "cc"] },
    cameraHelper: true,
    debug: true,
  });

  const userCamRef = useRef();
  useHelper(
    userConfig.cameraHelper && userConfig.camera !== "user" && userCamRef,
    THREE.CameraHelper
  );

  const facemeshApiRef = useRef();

  const [irisRightDirPos] = useState(() => new THREE.Vector3());
  const [irisLeftDirPos] = useState(() => new THREE.Vector3());
  const [posTarget] = useState(() => new THREE.Vector3());
  const [posCurrent] = useState(() => new THREE.Vector3());
  const [irisRightLookAt] = useState(() => new THREE.Vector3());
  const [irisLeftLookAt] = useState(() => new THREE.Vector3());
  const [lookAtTarget] = useState(() => new THREE.Vector3());
  const [lookAtCurrent] = useState(() => new THREE.Vector3());
  useFrame((_, delta) => {
    const userCam = userCamRef.current;
    const facemeshApi = facemeshApiRef.current;

    if (userCam && facemeshApi) {
      const { meshRef, eyeRightRef, eyeLeftRef } = facemeshApi;

      const mesh = meshRef.current;
      const eyeRight = eyeRightRef.current;
      const eyeLeft = eyeLeftRef.current;

      if (eyeRight && eyeLeft) {
        const { irisDirRef: irisRightDirRef } = eyeRight;
        const { irisDirRef: irisLeftDirRef } = eyeLeft;

        const irisRightDir = irisRightDirRef.current;
        const irisLeftDir = irisLeftDirRef.current;

        //
        // usercam pos: mean of irisRightDirPos,irisLeftDirPos
        //
        irisRightDir.getWorldPosition(irisRightDirPos);
        irisLeftDir.getWorldPosition(irisLeftDirPos);
        posTarget.copy(mean(irisRightDirPos, irisLeftDirPos));

        //
        // usercame lookAt: mean of irisRightLookAt,irisLeftLookAt
        //
        irisRightLookAt.copy(
          irisRightDir.localToWorld(new THREE.Vector3(0, 0, -1))
        );
        irisLeftLookAt.copy(
          irisLeftDir.localToWorld(new THREE.Vector3(0, 0, -1))
        );
        lookAtTarget.copy(mean(irisRightLookAt, irisLeftLookAt));
      } else {
        mesh.getWorldPosition(posTarget);
        lookAtTarget.copy(mesh.localToWorld(new THREE.Vector3(0, 0, -1)));
      }

      damp3(posCurrent, posTarget, delta);
      userCam.position.copy(posCurrent);

      damp3(lookAtCurrent, lookAtTarget, delta);
      userCam.lookAt(lookAtCurrent);
    }
  });

  useEffect(() => {
    async function f() {
      setStream(
        await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            // width: 9999, // ask for max res
          },
        })
      );
    }
    f().catch(console.error);
  }, []);

  return (
    <>
      <Laptop ref={facemeshApiRef} castShadow stream={stream} />
      <PerspectiveCamera
        ref={userCamRef}
        makeDefault={userConfig.camera === "user"}
        fov={50}
      />

      <Ground />

      <CameraControls makeDefault={userConfig.camera === "cc"} />

      <ambientLight intensity={0.2} />
      <spotLight
        castShadow
        position={[1, 5, 3]}
        penumbra={0.2}
        shadow-bias={-0.005}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* <axesHelper /> */}
      <Environment preset="city" />
    </>
  );
}

function Ground() {
  const gridConfig = {
    cellSize: 0.1,
    cellThickness: 0.5,
    cellColor: "#6f6f6f",
    sectionSize: 1,
    sectionThickness: 1,
    // sectionColor: "#f7d76d",
    fadeDistance: 10,
    fadeStrength: 2,
    followCamera: false,
    infiniteGrid: true,
  };
  return <Grid args={[10, 10]} {...gridConfig} />;
}
