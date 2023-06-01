import * as THREE from "three";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Grid,
  AccumulativeShadows,
  RandomizedLight,
  Environment,
  CameraControls,
  PerspectiveCamera,
  useHelper,
  Stats,
  Box,
  useGLTF,
  Center,
} from "@react-three/drei";
import { useControls, button, folder } from "leva";
import { easing } from "maath";

import FaceLandmarker, { FaceLandmarkerDefaults } from "./components/FaceLandmarker";

import { FaceControls } from "./components/FaceControls";

export default function App() {
  const visionBasePath = new URL("/tasks-vision-wasm", import.meta.url).toString() // prettier-ignore
  const modelAssetPath = new URL("/face_landmarker.task", import.meta.url).toString() // prettier-ignore

  const faceLandmarkerOptions = { ...FaceLandmarkerDefaults.options };
  faceLandmarkerOptions.baseOptions.modelAssetPath = modelAssetPath;

  return (
    <>
      <FaceLandmarker basePath={visionBasePath} options={faceLandmarkerOptions}>
        <Canvas shadows camera={{ position: [-0.6, 0.1, 0.6], near: 0.01 }}>
          <Scene />
        </Canvas>
        <Stats />
      </FaceLandmarker>
    </>
  );
}

function Scene() {
  const gui = useControls({
    camera: { value: "user", options: ["user", "cc"] },
    smoothTime: { value: 0.45, min: 0.000001, max: 1 },
    offset: true,
    offsetScalar: { value: 80, min: 0, max: 500 },
    eyes: false,
    eyesAsOrigin: false,
    origin: { value: 0, optional: true, disabled: true, min: 0, max: 477, step: 1 },
    depth: { value: 0.15, min: 0, max: 1, optional: true, disabled: true },
    player: folder({
      rotation: [0, -Math.PI / 2, 0],
      position: [-0.2, 0.2, 0],
    }),
  });

  const userCamRef = useRef();
  useHelper(gui.camera !== "user" && userCamRef, THREE.CameraHelper);

  const [userCam, setUserCam] = useState();

  const controls = useThree((state) => state.controls);
  const faceControlsApiRef = useRef();

  const onVideoFrame = useCallback(
    (e) => {
      controls.detect(e.texture.source.data, e.time);
    },
    [controls]
  );

  const [current] = useState(() => new THREE.Object3D());
  useFrame((_, delta) => {
    if (faceControlsApiRef.current) {
      const target = faceControlsApiRef.current.computeTarget();

      // faceControlsApiRef.current.update(delta, target);
      // userCam.position.copy(target.position);
      // userCam.rotation.copy(target.rotation);
      const eps = 1e-9;
      easing.damp3(current.position, target.position, gui.smoothTime, delta, undefined, undefined, eps);
      easing.dampE(current.rotation, target.rotation, gui.smoothTime, delta, undefined, undefined, eps);

      userCam.position.copy(current.position);
      userCam.rotation.copy(current.rotation);
    }
  });

  return (
    <>
      <Center top>
        <Suzi rotation={[-0.63, 0, 0]} scale={0.1} />
      </Center>

      <group rotation={gui.rotation} position={gui.position}>
        <FaceControls
          camera={userCam}
          ref={faceControlsApiRef}
          makeDefault
          manualUpdate
          manualDetect
          onVideoFrame={onVideoFrame}
          smoothTime={gui.smoothTime}
          offset={gui.offset}
          offsetScalar={gui.offsetScalar}
          eyes={gui.eyes}
          eyesAsOrigin={gui.eyesAsOrigin}
          depth={gui.depth}
          facemesh={{ origin: gui.origin, position: [0, 0, 0] }}
          debug={gui.camera !== "user"}
        />
        <PerspectiveCamera
          ref={(cam) => {
            userCamRef.current = cam;
            setUserCam(cam);
          }}
          makeDefault={gui.camera === "user"}
          fov={70}
          near={0.1}
          far={2}
        />
      </group>

      {/* <axesHelper /> */}
      <Ground />
      {/* <Shadows /> */}

      <CameraControls />

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

const Suzi = (props, ref) => {
  const { nodes } = useGLTF(
    "https://market-assets.fra1.cdn.digitaloceanspaces.com/market-assets/models/suzanne-high-poly/model.gltf"
  );
  return (
    <>
      <mesh castShadow receiveShadow geometry={nodes.Suzanne.geometry} {...props}>
        <meshStandardMaterial color="#9d4b4b" />
      </mesh>
    </>
  );
};

const Shadows = memo(() => (
  <AccumulativeShadows temporal frames={100} color="#9d4b4b" colorBlend={0.5} alphaTest={0.9} scale={20}>
    <RandomizedLight amount={8} radius={4} position={[5, 5, -10]} />
  </AccumulativeShadows>
));
