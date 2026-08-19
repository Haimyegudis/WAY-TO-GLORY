import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AvatarLook } from '@fc/engine';
import type { KitColours } from './build.js';
import { buildHuman } from './human.js';

/**
 * The figure on screen, turned by a finger.
 *
 * One renderer per view, thrown away when the view goes; the figure is rebuilt whenever
 * the look changes, which on the creation screen is every tap. A drag spins him, and
 * left alone he turns slowly by himself so it reads as a character rather than a
 * photograph.
 */
/**
 * The rotation at which he is looking at you.
 *
 * The base mesh faces the camera at zero, so the close-up opens on his face rather than
 * on whatever angle the slow turn had reached.
 */
const FACING = 0;

/**
 * Where the camera stands: the whole man, or close enough to read a nose.
 *
 * Aimed off the figure actually standing there rather than off the height he was asked
 * for. The morph targets move his head - the male body is taller than the neutral one it
 * is built from - so a camera placed at a fraction of the requested height looks at his
 * throat and leaves the face above the frame.
 */
function aim(camera: THREE.PerspectiveCamera, framing: 'body' | 'face', top: number): void {
  if (framing === 'face') {
    const eyes = top * 0.945;
    camera.fov = 24;
    camera.position.set(0, eyes, 0.62);
    camera.lookAt(0, eyes, 0);
  } else {
    camera.fov = 34;
    camera.position.set(0, top * 0.56, 4.0);
    camera.lookAt(0, top * 0.53, 0);
  }
  camera.updateProjectionMatrix();
}

export function AvatarView({
  look,
  heightCm,
  kit,
  height = 260,
  spin = true,
  framing = 'body',
}: {
  look: AvatarLook;
  heightCm: number;
  kit: KitColours;
  height?: number;
  spin?: boolean;
  /** Whole figure, or close enough to see what a nose slider is doing. */
  framing?: 'body' | 'face';
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const figure = useRef<THREE.Group | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  /*
   * Read by the animation loop rather than closed over.
   *
   * Anything the loop depends on that also lives in the effect's dependencies rebuilds
   * the renderer when it changes - and rebuilding the renderer leaves the figure behind
   * in the old scene. That is why the face view opened on an empty pitch twice.
   */
  const spinning = useRef(spin);
  spinning.current = spin;
  // Read, not depended on: the figure must not be rebuilt because the camera moved.
  const framed = useRef(framing);
  framed.current = framing;
  const turn = useRef(FACING + 0.35);
  /** How tall he came out once the morphs had their say, measured off the figure. */
  const top = useRef(heightCm / 100);
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
    /*
     * Two framings, because they answer different questions.
     *
     * The whole figure says what he is built like; a nose slider says nothing at all
     * from four metres away. The face view stands where a person stands when they are
     * talking to you.
     */
    const view3d = new THREE.PerspectiveCamera(34, width / height, 0.05, 40);
    camera.current = view3d;
    aim(view3d, framing, top.current);

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
        if (spinning.current && dragging.current === null) turn.current += 0.004;
        figure.current.rotation.y = turn.current;
      }
      renderer.render(view, view3d);
    };
    draw();

    const resize = () => {
      const w = mount.clientWidth || width;
      view3d.aspect = w / height;
      view3d.updateProjectionMatrix();
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
  }, [height]);

  /*
   * Re-aiming rather than rebuilding.
   *
   * Recreating the scene to change the framing threw the figure away with it - it
   * belonged to the old scene, and the effect that builds it had no reason to run again,
   * so the face view opened on an empty pitch.
   */
  useEffect(() => {
    if (camera.current) aim(camera.current, framing, top.current);
    // Looking at somebody's face means looking at their face: the figure turns slowly on
    // its own, so by the time the close-up opens he could be facing anywhere, and the
    // first thing the view showed was the back of his head.
    if (framing === 'face') {
      turn.current = FACING;
      if (figure.current) figure.current.rotation.y = FACING;
    }
  }, [framing, heightCm]);

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
      clear();
      built.rotation.y = turn.current;
      scene.current.add(built);
      figure.current = built;
      top.current = new THREE.Box3().setFromObject(built).max.y;
      if (camera.current) aim(camera.current, framed.current, top.current);
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
