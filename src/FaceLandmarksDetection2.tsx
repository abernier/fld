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
import {
  FilesetResolver,
  FaceLandmarker,
  Classifications,
  ImageSource,
} from "@mediapipe/tasks-vision";

const FaceLandmarksDetectionContext = createContext({});

type FaceLandmarksDetectionProps = {
  children: ReactNode;
};

export default function FaceLandmarksDetection({
  children,
  ...props
}: FaceLandmarksDetectionProps) {
  const creatingFaceLandmarkerRef = useRef(false); // singleton

  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker>();
  useEffect(() => {
    async function createFaceLandmarker() {
      if (creatingFaceLandmarkerRef.current === false) {
        creatingFaceLandmarkerRef.current = true;

        const vision = await FilesetResolver.forVisionTasks(
          new URL("/tasks-vision-wasm", import.meta.url).toString()
          // "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.1.0-alpha-16/wasm"
        );
        console.log("vision", vision);

        // see mediapipe doc: https://developers.google.com/mediapipe/solutions/vision/face_landmarker/web_js
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            // modelAssetPath: // "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
            modelAssetPath: new URL("/face_landmarker.task", import.meta.url).toString(), // prettier-ignore
            // delegate: "GPU",
          },
          runningMode: "VIDEO",
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });

        console.log("faceLandmarkder", faceLandmarker);
        setFaceLandmarker(faceLandmarker);

        creatingFaceLandmarkerRef.current = false;
      } else {
        console.log("skipping, still creating...");
      }
    }

    createFaceLandmarker().catch((err) =>
      console.error("error while creating faceLandmarker", err)
    );
  }, []);

  //
  // api
  //

  const estimateFaces = useCallback(
    async function (input: ImageSource, timestamp = Date.now()) {
      if (!faceLandmarker) {
        console.log(faceLandmarker);
        throw new Error("cannot estimate (yet), faceLandmarker not ready");
      }

      return await faceLandmarker.detectForVideo(input, timestamp);
    },
    [faceLandmarker]
  );

  const api = useMemo(() => ({ estimateFaces }), [estimateFaces]);

  return (
    <FaceLandmarksDetectionContext.Provider value={api}>
      {children}
    </FaceLandmarksDetectionContext.Provider>
  );
}

export function useFaceLandmarksDetection() {
  return useContext(FaceLandmarksDetectionContext);
}
