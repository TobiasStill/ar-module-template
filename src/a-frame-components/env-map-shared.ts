// Shared helper for cubemap-static.ts and cubemap-realtime.ts (not a
// component itself, so it isn't registered in the manifest).
//
// Applies an environment map to every mesh material under a root object.
// Materials are cloned on first touch, never mutated in place: glTF assets
// loaded via gltf-model share one material object across every instance of
// that asset, so writing envMap onto the shared material would leak the
// reflection onto every other copy of the model (see AGENTS.md §5). The
// original 8th Wall components mutated in place; cloning is the template's
// rule and changes nothing visually for a single instance.

const CLONED_FLAG = "__envMapCloned";

type MaterialFilter = (material: any) => boolean;

function materialsOf(node: any): any[] {
  const m = node.material;
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

/**
 * Sets envMap (and, if given, reflectivity / envMapIntensity) on every material under `root`
 * that supports an envMap and passes `filter`. Pass `envMap: null` to remove
 * it again (the clone is kept; it's already private to this entity).
 */
export function applyEnvMap(
  root: any,
  envMap: any,
  options: { reflectivity?: number; intensity?: number; filter?: MaterialFilter } = {}
): void {
  if (!root) return;
  root.traverse((node: any) => {
    if (!node.isMesh) return;
    const materials = materialsOf(node);
    const cloned = materials.map((material: any) => {
      if (!material || !("envMap" in material)) return material;
      if (options.filter && !options.filter(material)) return material;
      const own = material.userData?.[CLONED_FLAG] ? material : material.clone();
      own.userData[CLONED_FLAG] = true;
      own.envMap = envMap;
      if (options.reflectivity !== undefined) own.reflectivity = options.reflectivity;
      if (options.intensity !== undefined && "envMapIntensity" in own) own.envMapIntensity = options.intensity;
      own.needsUpdate = true;
      return own;
    });
    node.material = Array.isArray(node.material) ? cloned : cloned[0];
  });
}
