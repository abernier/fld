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

import FaceLandmarksDetection from "./FaceLandmarksDetection2";
import { Laptop } from "./Laptop";
import { Webcam } from "./Webcam";

const { DEG2RAD } = THREE.MathUtils;

export default function App() {
  return (
    <>
      <FaceLandmarksDetection>
        <Canvas shadows camera={{ position: [-0.6, 0.1, 0.6], near: 0.01 }}>
          <Scene />
        </Canvas>
        <Stats />
      </FaceLandmarksDetection>
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
    smoothTime: { value: 0.25, min: 0.000001, max: 2 },
    distance: { value: 0, min: 0, max: 2 },
    height: { value: 0.12, min: -0.5, max: 0.5 },
    facialTransformationMatrix: true,
    offset: true,
    eyes: false,
    debug: true,
  });

  const damp3 = useCallback(
    (current, target, delta) => {
      easing.damp3(
        current,
        target,
        userConfig.smoothTime,
        delta,
        undefined,
        undefined,
        0.000000001
      );
    },
    [userConfig.smoothTime]
  );

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

  return (
    <>
      <Webcam>
        {(faces, texture) => {
          const _faces = faces.faceLandmarks || faces;

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
                      // const { xMin, yMin, width, height } = face.box;
                      // const x = -(xMin + width / 2 - 640 / 2) / 640;
                      // const y = -(yMin + height / 2 - 480 / 2) / 480;
                      // const l = new THREE.Vector3()
                      //   .copy(face.keypoints[159])
                      //   .sub(new THREE.Vector3().copy(face.keypoints[386]))
                      //   .length();
                      // console.log("l=", l);
                      // const vfov = 60;
                      // const d =
                      //   (0.66 * 480) / (2 * Math.tan((vfov * DEG2RAD) / 2) * l);
                      // console.log("d=", d);
                      // console.log(x, y);
                      // const SCALE = 0.5;

                      const points = face.keypoints || face;

                      return (
                        <group
                          key={i}
                          // position={[SCALE * x, SCALE * y, 0]}
                          //
                        >
                          <Facemesh
                            ref={i === 0 ? facemeshApiRef : undefined}
                            points={points}
                            facialTransformationMatrix={
                              userConfig.facialTransformationMatrix
                                ? faces.facialTransformationMatrixes[i]
                                : undefined
                            }
                            depth={0.13}
                            offset={userConfig.offset}
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
