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

function absUrl(url: string) {
  return new URL(url, import.meta.url).toString();
}
const visionWasmBasePath = absUrl("/tasks-vision-wasm");
const visionModelAssetPath = absUrl("/face_landmarker.task");

export default function FaceLandmarksDetection({
  children,
  ...props
}: FaceLandmarksDetectionProps) {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker>();
  useEffect(() => {
    let ret: FaceLandmarker;

    FilesetResolver.forVisionTasks(visionWasmBasePath)
      .then((vision) =>
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: visionModelAssetPath,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
        })
      )
      .then((faceLandmarker) => {
        ret = faceLandmarker;
        setFaceLandmarker(ret);
      })
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
