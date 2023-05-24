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
  FaceLandmarker as FaceLandmarkerImpl,
  FaceLandmarkerResult,
  ImageSource,
} from "@mediapipe/tasks-vision";

const FaceLandmarkerContext = createContext({});

type FaceLandmarkerProps = {
  children: ReactNode;
};

export default function FaceLandmarker({
  children,
  ...props
}: FaceLandmarkerProps) {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarkerImpl>();
  useEffect(() => {
    let ret: FaceLandmarkerImpl;

    const visionBasePath = new URL("/tasks-vision-wasm", import.meta.url).toString() // prettier-ignore
    const modelAssetPath = new URL("/face_landmarker.task",import.meta.url).toString() // prettier-ignore

    FilesetResolver.forVisionTasks(visionBasePath)
      .then((vision) =>
        FaceLandmarkerImpl.createFromOptions(vision, {
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
    <FaceLandmarkerContext.Provider value={api}>
      {children}
    </FaceLandmarkerContext.Provider>
  );
}

export function useFaceLandmarker() {
  return useContext(FaceLandmarkerContext);
}
