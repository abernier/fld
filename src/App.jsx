import * as THREE from "three";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Grid,
  AccumulativeShadows,
  RandomizedLight,
  Environment,
  CameraControls,
  PerspectiveCamera,
  useHelper,
  Stats,
} from "@react-three/drei";
import { useControls, button, folder } from "leva";
import { easing } from "maath";

import { Facemesh } from "./components/Facemesh";

import FaceLandmarker from "./FaceLandmarker";
import { Laptop } from "./Laptop";
import { Webcam } from "./Webcam";

export default function App() {
  return (
    <>
      <FaceLandmarker>
        <Canvas shadows camera={{ position: [-0.6, 0.1, 0.6], near: 0.01 }}>
          <Scene />
        </Canvas>
        <Stats />
      </FaceLandmarker>
    </>
  );
}

function mean(v1, v2) {
  return v1.add(v2).multiplyScalar(0.5);
}

function Scene() {
  const userConfig = useControls({
    camera: { value: "cc", options: ["user", "cc"] },
    cameraHelper: true,
    smoothTimePos: { value: 0.25, min: 0.000001, max: 2 },
    distance: { value: 0, min: 0, max: 2 },
    height: { value: 0.25, min: -0.5, max: 0.5 },
    facialTransformationMatrix: true,
    faceBlendshapes: true,
    offset: true,
    offsetScalar: { value: 80, min: 0, max: 200 },
    eyes: true,
    debug: true,
  });

  const damp3 = useCallback((current, target, smoothTime = 0.25, delta) => {
    easing.damp3(
      current,
      target,
      smoothTime,
      delta,
      undefined,
      undefined,
      0.000000001
    );
  }, []);

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
        irisRightLookAt.copy(
          irisRightDirRef.current.localToWorld(new THREE.Vector3(0, 0, -1))
        );
        irisLeftLookAt.copy(
          irisLeftDirRef.current.localToWorld(new THREE.Vector3(0, 0, -1))
        );
        lookAtTarget.copy(mean(irisRightLookAt, irisLeftLookAt));
      } else {
        meshRef.current.getWorldPosition(posTarget);
        lookAtTarget.copy(
          meshRef.current.localToWorld(new THREE.Vector3(0, 0, -1))
        );
      }

      damp3(posCurrent, posTarget, userConfig.smoothTimePos, delta);
      userCam.position.copy(posCurrent);

      damp3(lookAtCurrent, lookAtTarget, userConfig.smoothTimePos, delta);
      userCam.lookAt(lookAtCurrent);
    }
  });

  return (
    <>
      <Webcam>
        {(faces, texture) => {
          const _faces = (faces && faces.faceLandmarks) || faces;

          return (
            <>
              <Laptop castShadow position-z={-0} flipHorizontal>
                <meshStandardMaterial map={texture} />
              </Laptop>

              <group
                position-y={userConfig.height}
                position-z={userConfig.distance} // 50cm distance with the webcam
              >
                {_faces?.length > 0
                  ? _faces.map((face, i) => {
                      const points = face.keypoints || face;

                      return (
                        <group key={i}>
                          <Facemesh
                            ref={i === 0 ? facemeshApiRef : undefined}
                            points={points}
                            facialTransformationMatrix={
                              userConfig.facialTransformationMatrix
                                ? faces.facialTransformationMatrixes[i]
                                : undefined
                            }
                            faceBlendshapes={
                              userConfig.faceBlendshapes
                                ? faces.faceBlendshapes[i]
                                : undefined
                            }
                            depth={0.13}
                            offset={userConfig.offset}
                            offsetScalar={userConfig.offsetScalar}
                            // origin={168}
                            eyes={userConfig.eyes}
                            debug={userConfig.debug}
                            rotation-z={Math.PI}
                            visible={userConfig.camera !== "user"}
                          >
                            <meshStandardMaterial
                              color="#ccc"
                              side={THREE.DoubleSide}
                              flatShading={true}
                              // wireframe
                              transparent
                              opacity={0.9}
                            />
                          </Facemesh>
                        </group>
                      );
                    })
                  : null}
              </group>
            </>
          );
        }}
      </Webcam>

      <PerspectiveCamera
        ref={userCamRef}
        makeDefault={userConfig.camera === "user"}
        fov={70}
        near={0.1}
        far={1}
      />

      {/* <axesHelper /> */}
      <Ground />

      <CameraControls makeDefault={userConfig.camera === "cc"} />

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
