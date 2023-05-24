import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  FilesetResolver,
  FaceLandmarker as FaceLandmarkerImpl,
} from "@mediapipe/tasks-vision";

const FaceLandmarkerContext = createContext(
  {} as FaceLandmarkerImpl | undefined
);

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
        console.error("error while creating faceLandmarker", err)
      );

    return () => void ret?.close();
  }, []);

  return (
    <FaceLandmarkerContext.Provider value={faceLandmarker}>
      {children}
    </FaceLandmarkerContext.Provider>
  );
}

export function useFaceLandmarker() {
  return useContext(FaceLandmarkerContext);
}
