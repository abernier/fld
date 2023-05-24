import * as THREE from "three";
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
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker>();
  useEffect(() => {
    let ret: FaceLandmarker;

    const visionBasePath = new URL("/tasks-vision-wasm", import.meta.url).toString() // prettier-ignore
    const modelAssetPath = new URL("/face_landmarker.task",import.meta.url).toString() // prettier-ignore

    FilesetResolver.forVisionTasks(visionBasePath)
      .then((vision) =>
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        })
      )
      .then((faceLandmarker) => setFaceLandmarker(faceLandmarker))
      .catch((err) =>
        console.error("error while creating facelandmarker", err)
      );

    return () => void ret?.close();
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

      const results = await faceLandmarker.detectForVideo(input, timestamp);
      return results;
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
