import { injectCpuTamerByAnimationFrame } from './cpu-tamer-by-animationframe';
import { injectCpuTamerByDomMutation } from './cpu-tamer-by-dom-mutation';

const isGPUAccelerationAvailable = () => {
  // https://gist.github.com/cvan/042b2448fcecefafbb6a91469484cdf8
  try {
    const canvas = document.createElement('canvas');
    const context = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    // Free the probe context now instead of keeping it until garbage collection
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!context;
  } catch {
    return false;
  }
};

export const injectCpuTamer = () => {
  if (isGPUAccelerationAvailable()) {
    injectCpuTamerByAnimationFrame(null);
  } else {
    injectCpuTamerByDomMutation(null);
  }
};
