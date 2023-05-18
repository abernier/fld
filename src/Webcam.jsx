import * as THREE from "three";
import { useState, Suspense, forwardRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  useVideoTexture,
  // Facemesh,
} from "@react-three/drei";
import { useControls } from "leva";

import { Facemesh } from "./components/Facemesh";
import { useFaceLandmarksDetection } from "./FaceLandmarksDetection";

const { DEG2RAD } = THREE.MathUtils;

export const Webcam = forwardRef(({ children, ...props }, fref) => {
  const [stream, setStream] = useState();
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
    <Suspense fallback={null}>
      <VideoMaterial src={stream} ref={fref}>
        {children}
      </VideoMaterial>
    </Suspense>
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
    setFaces(faces);
  });

  const { distance, height, eyes, debug } = useControls({
    // distance: { value: 0.2, min: 0, max: 2 },
    // height: { value: -0.1, min: -1, max: 1 },
    debug: true,
    eyes: true,
  });

  return (
    <>
      <meshStandardMaterial map={texture} toneMapped={false} />

      <group
      // position-y={height}
      // position-z={distance} // 50cm distance with the webcam
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
              </Facemesh>
            </group>
          );
        })}
      </group>
    </>
  );
});
