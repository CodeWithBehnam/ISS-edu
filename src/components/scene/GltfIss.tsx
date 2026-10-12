import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';

import { cloneMeshMaterials, meshMaterials } from './iss-materials';
import { MODEL_URLS } from './scene-constants';

/** The Blender-made station. Materials are cloned because the shadow dimming and the beacon animate them. */
export function GltfIss() {
  const { scene } = useGLTF(MODEL_URLS.iss, false);

  const model = useMemo(() => {
    const copy = scene.clone(true);
    cloneMeshMaterials(copy);
    return copy;
  }, [scene]);

  useEffect(
    () => () => {
      meshMaterials(model).forEach((material) => material.dispose());
    },
    [model],
  );

  return <primitive object={model} />;
}
