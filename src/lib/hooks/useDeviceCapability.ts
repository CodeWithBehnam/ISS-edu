

import { useEffect, useState } from 'react';

export type DeviceCapability = 'webgl' | 'canvas';

export function useDeviceCapability(): DeviceCapability {
  const [capability, setCapability] = useState<DeviceCapability>('canvas');

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      setCapability('webgl');
    }
    canvas.remove();
  }, []);

  return capability;
}

