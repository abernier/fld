import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import type {
  FaceLandmarksDetector,
  FaceLandmarksDetectorInput,
  MediaPipeFaceMeshMediaPipeEstimationConfig,
  MediaPipeFaceMeshTfjsEstimationConfig,
} from "@tensorflow-models/face-landmarks-detection";

const FaceLandmarksDetectionContext = createContext({});

type FaceLandmarksDetectionProps = {
  children: ReactNode;
};

export default function FaceLandmarksDetection({
  children,
  ...props
}: FaceLandmarksDetectionProps) {
  //
  // detector
  //

  const creatingDetectorRef = useRef(false); // singleton

  const [detector, setDetector] = useState<FaceLandmarksDetector>();
  useEffect(() => {
    let dtor: FaceLandmarksDetector;

    if (creatingDetectorRef.current === false) {
      creatingDetectorRef.current = true;

      faceLandmarksDetection
        .createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: "mediapipe",
            solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh`,
            refineLandmarks: false,
            maxFaces: 2,
          }
        )
        .then((d) => {
          dtor = d;
          console.log("detector ready", d);
          setDetector(d);
        })
        .catch((err) => console.error("error while creating detector", err))
        .finally(() => (creatingDetectorRef.current = false));
    } else {
      // console.log("skipping, still creating...");
    }

    // cleanup
    return () => {
      dtor?.dispose();
    };
  }, []);

  //
  // video stream
  //

  const [stream, setStream] = useState<MediaStream>();
  // useEffect(() => {
  //   let strm: MediaStream;
  //   navigator.mediaDevices
  //     .getUserMedia({
  //       audio: false,
  //       video: {
  //         facingMode: "user"
  //         // width: 9999, // ask for max res
  //       }
  //     })
  //     .then((s) => {
  //       strm = s;
  //       console.log("strm=", strm);
  //       setStream(s);
  //     })
  //     .catch(console.error);

  //   return () => void strm?.getTracks().forEach((track) => track.stop());
  // }, []);

  const [$video] = useState(document.createElement("video"));
  // useEffect(() => {
  //   if (!stream) return;

  //   function onloadedmetadata() {
  //     console.log("loadedmetadata", $video.videoWidth, $video.videoHeight);
  //     $video.play();
  //   }
  //   $video.addEventListener("loadedmetadata", onloadedmetadata);

  //   function oncanplay() {
  //     console.log("canplay");
  //     $video.play();
  //   }
  //   $video.addEventListener("canplay", oncanplay);

  //   $video.srcObject = stream; // 🔌 plug the stream into the <video>
  //   // cleanup
  //   return () => {
  //     $video.removeEventListener("loadedmetadata", onloadedmetadata);
  //     $video.removeEventListener("canplay", oncanplay);
  //   };
  // }, [$video, stream]);

  //
  // api
  //

  const estimateFaces = useCallback(
    async function (
      input: FaceLandmarksDetectorInput = $video,
      estimationConfig:
        | MediaPipeFaceMeshMediaPipeEstimationConfig
        | MediaPipeFaceMeshTfjsEstimationConfig
    ) {
      if (!detector) {
        console.log(detector);
        throw new Error("cannot estimate (yet), detector not ready");
      }

      return await detector.estimateFaces(input);
    },
    [detector, $video]
  );

  const value = useMemo(
    () => ({
      detector,
      stream,
      $video,
      estimateFaces,
    }),
    [detector, stream, $video, estimateFaces]
  );

  return (
    <FaceLandmarksDetectionContext.Provider value={value}>
      {children}
    </FaceLandmarksDetectionContext.Provider>
  );
}

export function useFaceLandmarksDetection() {
  return useContext(FaceLandmarksDetectionContext);
}
