import { useState, Suspense, forwardRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useVideoTexture } from "@react-three/drei";

import { useFaceLandmarksDetection } from "./FaceLandmarksDetection";

const isFunction = (node) => typeof node === "function";

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

  const functional = isFunction(children);
  return (
    <>
      <meshStandardMaterial map={texture} toneMapped={false} />

      {functional ? children(faces, texture) : children}
    </>
  );
});
