import * as THREE from "three";
import { useState, Suspense, forwardRef, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  useVideoTexture,
  Plane,
  Box,
  Circle,
  // Facemesh,
} from "@react-three/drei";
import { useControls, button, folder } from "leva";

import { Facemesh } from "./components/Facemesh";
import { useFaceLandmarksDetection } from "./FaceLandmarksDetection";

const { DEG2RAD } = THREE.MathUtils;

export const Laptop = forwardRef(({ stream, children, ...props }, fref) => {
  const w = 0.31;
  const h = 0.22;
  const d = 0.01;

  const { openAngle } = useControls({
    Laptop: folder({ openAngle: { value: 100, min: 0, max: 120 } }),
  });
  const webcamRatio = 640 / 480;

  return (
    <group {...props}>
      <group position-z={-h / 2}>
        {/* Lid */}
        <group position-y={d / 2} rotation-x={(90 - openAngle) * DEG2RAD}>
          <Plane
            args={[w - 0.0005, h - 0.0005]}
            position-y={h / 2}
            position-z={0.00001}
          >
            <meshStandardMaterial color="black" />
          </Plane>
          <Plane args={[w, h]} position-y={h / 2}>
            <meshStandardMaterial color="gray" side={THREE.DoubleSide} />

            {/* webcam */}
            <group position-y={h / 2 - 0.03 * h}>
              <axesHelper args={[0.05]} />
              <group position-z={0.1}>
                {/* video */}
                <Plane args={[0.1 * w, (0.1 * w) / webcamRatio]}>
                  <Suspense fallback={null}>
                    <VideoMaterial
                      ref={fref}
                      src={stream}
                      side={THREE.DoubleSide}
                    >
                      {children}
                    </VideoMaterial>
                  </Suspense>
                </Plane>
              </group>
            </group>
          </Plane>
        </group>
        {/* Base */}
        <Box position-z={h / 2} args={[w, d, h]}>
          <meshStandardMaterial color="gray" />
        </Box>
      </group>
    </group>
  );
});

const VideoMaterial = forwardRef(({ src, children, ...props }, fref) => {
  const [faces, setFaces] = useState([]);
  const texture = useVideoTexture(src);

  const video = texture.source.data;
  // console.log("video", video);

  const { estimateFaces } = useFaceLandmarksDetection();
  // console.log("fld=", fld);

  // useControls(
  //   {
  //     FDL: folder({
  //       estimateFaces: button(async (get) => {
  //         const faces = await fld
  //           .estimateFaces(video, { flipHorizontal: false })
  //           .catch((err) => console.log("error estimating faces", err));
  //         console.log("faces=", faces);
  //         setFaces(faces);
  //       }),
  //     }),
  //   },
  //   [fld, video]
  // );
  useFrame(async () => {
    const faces = await estimateFaces(video).catch((err) =>
      console.log("error estimating faces", err)
    );
    // console.log(
    //   "faces=",
    //   faces[0].keypoints[468].z,
    //   faces[0].keypoints[469].z,
    //   faces[0].keypoints[470].z,
    //   faces[0].keypoints[471].z,
    //   faces[0].keypoints[472].z
    // );
    setFaces(faces);
  });

  const { distance, height, eyes, debug } = useControls({
    distance: { value: 0.2, min: 0, max: 2 },
    height: { value: -0.1, min: -1, max: 1 },
    debug: true,
    eyes: true,
  });

  return (
    <>
      <meshStandardMaterial
        map={texture}
        toneMapped={false}
        // side={THREE.DoubleSide}
      />

      <group
        position-y={height}
        position-z={distance} // 50cm distance with the webcam
      >
        {faces.map((face, i) => {
          const { xMin, yMin, width, height } = face.box;
          const x = -(xMin + width / 2 - 640 / 2) / 640;
          const y = -(yMin + height / 2 - 480 / 2) / 480;
          const l = new THREE.Vector3()
            .copy(face.keypoints[159])
            .sub(new THREE.Vector3().copy(face.keypoints[386]))
            .length();
          // console.log("l=", l);
          const vfov = 60;
          const d = (0.66 * 480) / (2 * Math.tan((vfov * DEG2RAD) / 2) * l);
          // console.log("d=", d);
          // console.log(x, y);

          const SCALE = 0.5;

          return (
            <group
              key={i}
              // position={[SCALE * x, SCALE * y, 0]}
              //
            >
              <Facemesh
                ref={i === 0 ? fref : undefined}
                face={face}
                depth={0.1}
                // origin={168}
                eyes={eyes}
                debug={debug}
                rotation-z={Math.PI}
              >
                <meshStandardMaterial
                  color="#ccc"
                  side={THREE.DoubleSide}
                  flatShading={true}
                  // wireframe
                  transparent
                  opacity={0.9}
                />
                {children}
              </Facemesh>
            </group>
          );
        })}
      </group>
    </>
  );
});
