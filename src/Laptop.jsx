import * as THREE from "three";
import { forwardRef } from "react";
import { Plane, Box } from "@react-three/drei";
import { useControls, folder } from "leva";

const { DEG2RAD } = THREE.MathUtils;

export const Laptop = forwardRef(({ children, ...props }, fref) => {
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
            {/* <group position-y={h / 2 - 0.03 * h}>
              <axesHelper args={[0.05]} />
              <group position-z={0.1}>
                <Plane args={[0.1 * w, (0.1 * w) / webcamRatio]}>
                  {children}
                </Plane>
              </group>
            </group> */}
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
