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

  const d2 = d / 10;

  return (
    <group {...props}>
      <group position-z={-h / 2}>
        {/* Lid */}
        <group position-y={d / 2} rotation-x={(90 - openAngle) * DEG2RAD}>
          <Box args={[w, h, d2]} position-y={h / 2} position-z={-d2 / 2}>
            <meshStandardMaterial color="gray" side={THREE.DoubleSide} />
            <Plane args={[w, h]} position-z={d2 / 2 + 0.0001}>
              <meshStandardMaterial color="black" />
            </Plane>
          </Box>
        </group>
        {/* Base */}
        <Box position-z={h / 2} args={[w, d, h]}>
          <meshStandardMaterial color="gray" />
        </Box>
      </group>
    </group>
  );
});
