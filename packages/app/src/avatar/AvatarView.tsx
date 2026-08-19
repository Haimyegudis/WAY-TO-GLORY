import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AvatarLook } from '@fc/engine';
import { addFeatures, type KitColours } from './build.js';
import { buildHuman } from './human.js';

/**
 * The figure on screen, turned by a finger.
 *
 * One renderer per view, thrown away when the view goes; the figure is rebuilt whenever
 * the look changes, which on the creation screen is every tap. A drag spins him, and
 * left alone he turns slowly by himself so it reads as a character rather than a
 * photograph.
 */
export function AvatarView({
  look,
  heightCm,
  kit,
  height = 260,
  spin = true,
}: {
  look: AvatarLook;
  heightCm: number;
  kit: KitColours;
  height?: number;
  spin?: boolean;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const figure = useRef<THREE.Group | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const turn = useRef(0.4);
  const dragging = useRef<number | null>(null);

  // The scene, once.
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    const width = mount.clientWidth || 320;
    const view = new THREE.Scene();
    scene.current = view;

    // Framed so he fills the box: a figure standing in the middle distance reads as a
    // toy, and this is supposed to be him.
    // A figure 1.9 units tall needs about 2.4 units of view to stand in with air above
    // his head: any closer and the camera crops him at the hairline.
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
    camera.position.set(0, 1.0, 4.0);
    camera.lookAt(0, 0.95, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // Three lights and no more: a key, a fill and a rim, which is what makes a matte
    // figure read as solid rather than as a cut-out.
    view.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff2dd, 1.15);
    key.position.set(2.5, 4, 3);
    view.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.5);
    rim.position.set(-3, 2, -2.5);
    view.add(rim);

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (figure.current) {
        if (spin && dragging.current === null) turn.current += 0.004;
        figure.current.rotation.y = turn.current;
      }
      renderer.render(view, camera);
    };
    draw();

    const resize = () => {
      const w = mount.clientWidth || width;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.current = null;
    };
  }, [height, spin]);

  // The figure, rebuilt whenever what he looks like changes. The body is a real mesh
  // loaded once and shaped per look, so this is asynchronous the first time and instant
  // after that.
  useEffect(() => {
    let alive = true;
    const view = scene.current;
    if (!view) return;
    void (async () => {
      const built = await buildHuman(look, heightCm, kit);
      if (!alive || !scene.current) return;
      addFeatures(built, look);
      clear();
      built.rotation.y = turn.current;
      scene.current.add(built);
      figure.current = built;
    })();
    return () => { alive = false; };
  }, [look, heightCm, kit]);

  /** Take the old figure off the scene and give its geometry back to the card. */
  const clear = () => {
    const view = scene.current;
    if (!view || !figure.current) return;
    view.remove(figure.current);
    figure.current.traverse((part) => {
      const mesh = part as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    figure.current = null;
  };

  return (
    <div
      ref={host}
      className="avatar-view"
      style={{ height }}
      onPointerDown={(event) => {
        dragging.current = event.clientX;
        (event.target as Element).setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragging.current === null) return;
        turn.current += (event.clientX - dragging.current) * 0.012;
        dragging.current = event.clientX;
      }}
      onPointerUp={() => { dragging.current = null; }}
      onPointerLeave={() => { dragging.current = null; }}
    />
  );
}
