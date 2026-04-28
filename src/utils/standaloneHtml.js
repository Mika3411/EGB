import {
  isFlexibleAnswerMatch,
  normalizeAnswer,
  parseJsonValue,
  randomRotations,
  sameColorSequence,
  sameNormalizedList,
  sameNormalizedSet,
  shuffledIndices,
  usesImage,
  validateMiscAnswer,
} from '../lib/gameEngine';
import { COLOR_OPTIONS, POPUP_OVERLAY_GRADIENTS } from '../data/enigmaConfig';
import { CODE_KEYPAD_KEYS } from '../data/playerConfig';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const serializeForScript = (value) => JSON.stringify(value).replace(/<\/script/gi, '<\\/script');

const buildStandaloneGameEngineScript = () => ([
  sameColorSequence,
  normalizeAnswer,
  isFlexibleAnswerMatch,
  parseJsonValue,
  sameNormalizedList,
  sameNormalizedSet,
  validateMiscAnswer,
  shuffledIndices,
  randomRotations,
  usesImage,
].map((fn) => fn.toString()).join('\n\n'));

export function buildStandaloneHtml(project) {
  const safeTitle = escapeHtml(project?.title || 'Escape Game');
  const serializedProject = serializeForScript(project);
  const serializedColorOptions = serializeForScript(COLOR_OPTIONS);
  const serializedPopupOverlayGradients = serializeForScript(POPUP_OVERLAY_GRADIENTS);
  const serializedCodeKeypadKeys = serializeForScript(CODE_KEYPAD_KEYS);
  const standaloneGameEngineScript = buildStandaloneGameEngineScript();

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Inter,Arial,sans-serif;background:
radial-gradient(circle at top left, rgba(79,140,255,.14), transparent 28%),
radial-gradient(circle at top right, rgba(59,130,246,.08), transparent 22%),
linear-gradient(180deg, #08101c 0%, #09111f 100%);color:#eef4ff}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.app-shell{max-width:1540px;margin:0 auto;padding:28px}
.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px}
.brand-block{max-width:760px}
.topbar h1{margin:0 0 10px;font-size:40px;line-height:1.04;letter-spacing:-.03em}
.topbar p{margin:0;color:#9fb0cc;line-height:1.6}
.status-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(79,140,255,0.12);border:1px solid rgba(96,165,250,0.2);color:#d9e7ff;font-weight:700;font-size:12px}
.topbar-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fullscreen-toggle{border:1px solid rgba(96,165,250,.25);background:rgba(18,31,56,.95);color:#fff;padding:11px 16px;border-radius:14px;box-shadow:none}
body.game-fullscreen{background:#000}
body.game-fullscreen .app-shell{max-width:none;width:100%;padding:0}
body.game-fullscreen .topbar{display:none}
body.game-fullscreen .layout{grid-template-columns:1fr;min-height:100vh;place-items:center}
body.game-fullscreen .side{display:none}
body.game-fullscreen .main{padding:0;border:none;border-radius:0;background:#000;box-shadow:none;display:grid;place-items:center;width:100%;min-height:100vh}
body.game-fullscreen .scene-player{width:min(100vw,calc(100vh * var(--scene-aspect,1.6)));height:min(100vh,calc(100vw / var(--scene-aspect,1.6)));aspect-ratio:var(--scene-aspect,1.6);min-height:0;border:none;border-radius:0}
body.game-fullscreen .inventory-actions{display:none}
body.game-fullscreen .scene-inline-viewer{padding:40px}
.fullscreen-hud{display:none}
.inventory-drawer{display:none}
body.game-fullscreen .fullscreen-hud{display:flex;position:fixed;left:20px;right:20px;bottom:20px;z-index:35;align-items:flex-end;justify-content:space-between;gap:16px;pointer-events:none}
body.game-fullscreen .fullscreen-dialogue{max-width:min(70vw,900px);padding:16px 20px;border-radius:20px;background:rgba(3,10,24,.72);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px);box-shadow:0 20px 50px rgba(0,0,0,.35);font-size:28px;line-height:1.5;color:#fff}
body.game-fullscreen .fullscreen-actions{display:flex;gap:12px;pointer-events:auto}
body.game-fullscreen .hud-button{border:1px solid rgba(96,165,250,.25);background:rgba(18,31,56,.95);color:#fff;padding:12px 18px;border-radius:14px;box-shadow:none}
body.game-fullscreen .inventory-drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,92vw);z-index:45;background:linear-gradient(180deg, rgba(12,20,37,.98) 0%, rgba(8,16,30,.98) 100%);border-left:1px solid rgba(148,163,184,.16);box-shadow:-20px 0 60px rgba(0,0,0,.34);padding:20px;overflow:auto}
body.game-fullscreen .inventory-drawer.open{display:block}
body.game-fullscreen .inventory-drawer__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
body.game-fullscreen .inventory-drawer__head h3{margin:0}
body.game-fullscreen .inventory-drawer__backdrop{position:fixed;inset:0;z-index:44;background:rgba(0,0,0,.45)}
.layout{display:grid;gap:18px;grid-template-columns:1fr 360px}
.panel{background:linear-gradient(180deg, rgba(12,20,37,.96) 0%, rgba(8,16,30,.96) 100%);border:1px solid rgba(148,163,184,.16);box-shadow:0 20px 60px rgba(0,0,0,.34);border-radius:28px;padding:20px}
.scene-player{position:relative;aspect-ratio:var(--scene-aspect,1.6);border-radius:24px;overflow:hidden;background:#020617;border:1px solid rgba(148,163,184,.12)}
.scene-player img.bg{width:100%;height:100%;object-fit:cover;display:block}
.scene-timer-hud{position:absolute;top:14px;right:14px;z-index:32;display:flex;align-items:center;gap:10px;min-height:38px;padding:8px 11px;border-radius:8px;color:#fff;background:rgba(2,6,23,.72);border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 34px rgba(0,0,0,.28);backdrop-filter:blur(10px);pointer-events:none}.scene-timer-hud strong{font-variant-numeric:tabular-nums;font-size:18px;line-height:1}.scene-timer-hud span{color:#cbd7ea;font-size:12px;white-space:nowrap}
.scene-transition-overlay{position:absolute;inset:0;z-index:90;pointer-events:none;overflow:hidden;background:#020617}
.scene-transition-overlay img,.scene-transition-overlay .placeholder{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;animation:sceneTransitionFadeOut var(--scene-transition-duration,700ms) ease both}
.scene-transition-overlay--slide-left img,.scene-transition-overlay--slide-left .placeholder{animation-name:sceneTransitionSlideLeft}
.scene-transition-overlay--slide-right img,.scene-transition-overlay--slide-right .placeholder{animation-name:sceneTransitionSlideRight}
.scene-transition-overlay--slide-up img,.scene-transition-overlay--slide-up .placeholder{animation-name:sceneTransitionSlideUp}
.scene-transition-overlay--slide-down img,.scene-transition-overlay--slide-down .placeholder{animation-name:sceneTransitionSlideDown}
.scene-transition-overlay--wipe-left img,.scene-transition-overlay--wipe-left .placeholder{animation-name:sceneTransitionWipeLeft}
.scene-transition-overlay--wipe-right img,.scene-transition-overlay--wipe-right .placeholder{animation-name:sceneTransitionWipeRight}
.scene-transition-overlay--wipe-up img,.scene-transition-overlay--wipe-up .placeholder{animation-name:sceneTransitionWipeUp}
.scene-transition-overlay--wipe-down img,.scene-transition-overlay--wipe-down .placeholder{animation-name:sceneTransitionWipeDown}
.scene-transition-overlay--zoom img,.scene-transition-overlay--zoom .placeholder{animation-name:sceneTransitionZoomOut}
.scene-transition-overlay--zoom-spin img,.scene-transition-overlay--zoom-spin .placeholder{animation-name:sceneTransitionZoomSpin}
.scene-transition-overlay--iris img,.scene-transition-overlay--iris .placeholder{animation-name:sceneTransitionIris}
.scene-transition-overlay--blur img,.scene-transition-overlay--blur .placeholder{animation-name:sceneTransitionBlur}
.scene-transition-overlay--dissolve img,.scene-transition-overlay--dissolve .placeholder{animation-name:sceneTransitionDissolve}
.scene-transition-overlay--flip img,.scene-transition-overlay--flip .placeholder{animation-name:sceneTransitionFlip;backface-visibility:hidden;transform-origin:center}
.scene-transition-overlay--rotate img,.scene-transition-overlay--rotate .placeholder{animation-name:sceneTransitionRotate}
.scene-transition-overlay--glitch img,.scene-transition-overlay--glitch .placeholder{animation-name:sceneTransitionGlitchOut}
.scene-transition-overlay--pixel img,.scene-transition-overlay--pixel .placeholder{animation-name:sceneTransitionPixelOut;image-rendering:pixelated}
.scene-transition-overlay--burn img,.scene-transition-overlay--burn .placeholder{animation-name:sceneTransitionBurnOut}
.scene-transition-overlay--curtain img,.scene-transition-overlay--curtain .placeholder{animation-name:sceneTransitionCurtainOut}
.scene-transition-overlay--split-horizontal img,.scene-transition-overlay--split-horizontal .placeholder{animation-name:sceneTransitionSplitHorizontal}
.scene-transition-overlay--split-vertical img,.scene-transition-overlay--split-vertical .placeholder{animation-name:sceneTransitionSplitVertical}
.scene-transition-overlay--flash::after{content:"";position:absolute;inset:0;z-index:4;background:#fff;animation:sceneTransitionFlash var(--scene-transition-duration,700ms) ease both}
.scene-transition-overlay--glitch::before{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 2px,transparent 3px 9px),linear-gradient(90deg,rgba(239,68,68,.24),transparent,rgba(56,189,248,.24));mix-blend-mode:screen;animation:sceneTransitionGlitchFlash var(--scene-transition-duration,700ms) steps(2,end) both}
.scene-transition-overlay--pixel::before{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(2,6,23,.38) 0 8px,transparent 8px 16px),repeating-linear-gradient(0deg,rgba(2,6,23,.34) 0 8px,transparent 8px 16px);animation:sceneTransitionPixelGrid var(--scene-transition-duration,700ms) steps(5,end) both}
.scene-transition-overlay--burn::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.95),rgba(250,204,21,.78) 18%,rgba(249,115,22,.35) 32%,transparent 54%);mix-blend-mode:screen;animation:sceneTransitionBurnGlow var(--scene-transition-duration,700ms) ease both}
.scene-transition-overlay--curtain::before,.scene-transition-overlay--curtain::after,.scene-transition-overlay--cinematic-bars::before,.scene-transition-overlay--cinematic-bars::after{content:"";position:absolute;z-index:5;pointer-events:none;background:#020617}
.scene-transition-overlay--curtain::before{inset:0 50% 0 0;animation:sceneTransitionCurtainLeft var(--scene-transition-duration,700ms) ease both}.scene-transition-overlay--curtain::after{inset:0 0 0 50%;animation:sceneTransitionCurtainRight var(--scene-transition-duration,700ms) ease both}
.scene-transition-overlay--cinematic-bars::before{left:0;right:0;top:0;height:50%;animation:sceneTransitionBarsTop var(--scene-transition-duration,700ms) ease both}.scene-transition-overlay--cinematic-bars::after{left:0;right:0;bottom:0;height:50%;animation:sceneTransitionBarsBottom var(--scene-transition-duration,700ms) ease both}
@keyframes sceneTransitionFadeOut{from{opacity:1}to{opacity:0}}
@keyframes sceneTransitionSlideLeft{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.86;transform:translate3d(-100%,0,0)}}
@keyframes sceneTransitionSlideRight{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.86;transform:translate3d(100%,0,0)}}
@keyframes sceneTransitionSlideUp{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.86;transform:translate3d(0,-100%,0)}}
@keyframes sceneTransitionSlideDown{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.86;transform:translate3d(0,100%,0)}}
@keyframes sceneTransitionWipeLeft{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 100% 0 0)}}@keyframes sceneTransitionWipeRight{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 0 0 100%)}}@keyframes sceneTransitionWipeUp{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(100% 0 0 0)}}@keyframes sceneTransitionWipeDown{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 0 100% 0)}}
@keyframes sceneTransitionZoomOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.16)}}
@keyframes sceneTransitionZoomSpin{from{opacity:1;transform:scale(1) rotate(0deg)}to{opacity:0;transform:scale(1.28) rotate(7deg)}}@keyframes sceneTransitionIris{from{clip-path:circle(75% at 50% 50%)}to{clip-path:circle(0% at 50% 50%)}}@keyframes sceneTransitionBlur{from{opacity:1;filter:blur(0) saturate(1);transform:scale(1)}to{opacity:0;filter:blur(18px) saturate(1.35);transform:scale(1.06)}}@keyframes sceneTransitionDissolve{0%{opacity:1;filter:contrast(1)}40%{opacity:.72;filter:contrast(1.8) brightness(1.12)}70%{opacity:.28;filter:contrast(2.6) brightness(1.24)}100%{opacity:0;filter:contrast(3) brightness(1.35)}}@keyframes sceneTransitionFlip{from{opacity:1;transform:perspective(900px) rotateY(0deg)}to{opacity:0;transform:perspective(900px) rotateY(88deg)}}@keyframes sceneTransitionRotate{from{opacity:1;transform:scale(1) rotate(0deg)}to{opacity:0;transform:scale(.72) rotate(-10deg)}}@keyframes sceneTransitionGlitchOut{0%,100%{opacity:1;transform:translate3d(0,0,0)}18%{transform:translate3d(-12px,0,0);filter:hue-rotate(60deg)}34%{transform:translate3d(10px,-2px,0);opacity:.86}52%{transform:translate3d(-7px,3px,0);filter:saturate(2)}74%{transform:translate3d(5px,0,0);opacity:.38}100%{opacity:0;transform:translate3d(0,0,0)}}@keyframes sceneTransitionGlitchFlash{0%,15%,62%,100%{opacity:0}20%,48%{opacity:.78}70%{opacity:.35}}@keyframes sceneTransitionPixelOut{from{opacity:1;filter:contrast(1);transform:scale(1)}to{opacity:0;filter:contrast(2.2);transform:scale(1.04)}}@keyframes sceneTransitionPixelGrid{from{opacity:0;background-size:6px 6px}45%{opacity:.8;background-size:12px 12px}to{opacity:0;background-size:24px 24px}}@keyframes sceneTransitionBurnOut{from{opacity:1;filter:brightness(1) saturate(1)}55%{opacity:.8;filter:brightness(1.45) saturate(1.5)}to{opacity:0;filter:brightness(2.4) saturate(2)}}@keyframes sceneTransitionBurnGlow{from{opacity:0;transform:scale(.2)}45%{opacity:.85;transform:scale(1.1)}to{opacity:0;transform:scale(1.8)}}@keyframes sceneTransitionCurtainOut{from{opacity:1}55%{opacity:1}to{opacity:0}}@keyframes sceneTransitionCurtainLeft{from{transform:translateX(-100%)}48%{transform:translateX(0)}to{transform:translateX(0)}}@keyframes sceneTransitionCurtainRight{from{transform:translateX(100%)}48%{transform:translateX(0)}to{transform:translateX(0)}}@keyframes sceneTransitionSplitHorizontal{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(50% 0 50% 0)}}@keyframes sceneTransitionSplitVertical{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 50% 0 50%)}}@keyframes sceneTransitionBarsTop{from{transform:translateY(-100%)}55%,to{transform:translateY(0)}}@keyframes sceneTransitionBarsBottom{from{transform:translateY(100%)}55%,to{transform:translateY(0)}}
@keyframes sceneTransitionFlash{0%{opacity:0}18%{opacity:.92}100%{opacity:0}}
.placeholder{width:100%;height:100%;min-height:220px;display:flex;align-items:center;justify-content:center;color:#7f92b2;padding:24px;text-align:center;background:rgba(10,18,33,.6)}
.player-hotspot{position:absolute;transform:translate(-50%,-50%);background:transparent!important;border:none!important;box-shadow:none!important;outline:none!important;padding:0!important;margin:0!important;border-radius:0!important;appearance:none;-webkit-appearance:none;z-index:20;pointer-events:auto;display:block}
.player-hotspot:hover,.player-hotspot:focus,.player-hotspot:active{background:transparent!important;border:none!important;box-shadow:none!important;outline:none!important}
.player-scene-object{position:absolute!important;transform:translate(-50%,-50%)!important;transform-origin:center center!important;z-index:18;cursor:pointer;display:block!important;pointer-events:auto;padding:0!important;margin:0!important;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;overflow:hidden!important;appearance:none!important;-webkit-appearance:none!important;line-height:0!important;box-sizing:border-box!important;min-width:0!important;min-height:0!important}
.player-scene-object:hover,.player-scene-object:focus,.player-scene-object:active{transform:translate(-50%,-50%)!important;padding:0!important;margin:0!important;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important}
.player-scene-object img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center center!important;display:block!important;pointer-events:none!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
.scene-visual-effect{position:absolute;inset:0;z-index:12;overflow:hidden;pointer-events:none}
.scene-visual-effect-zone{inset:auto;transform:translate(-50%,-50%)}
.scene-visual-effect--subtle{opacity:.48}.scene-visual-effect--normal{opacity:1}.scene-visual-effect--strong{opacity:1.45;filter:saturate(1.25) contrast(1.08)}
.scene-visual-effect--sparkles:before,.scene-visual-effect--sparkles:after{content:"";position:absolute;inset:-10%;background-image:radial-gradient(circle,rgba(255,255,255,.95) 0 1px,transparent 2px),radial-gradient(circle,rgba(191,219,254,.9) 0 1px,transparent 2px),radial-gradient(circle,rgba(250,204,21,.72) 0 1px,transparent 2px);background-size:130px 110px,190px 170px,240px 210px;background-position:12px 18px,80px 55px,140px 90px;opacity:.55;animation:sceneSparkleTwinkle 3.2s ease-in-out infinite alternate}
.scene-visual-effect--sparkles:after{filter:blur(.4px);opacity:.35;transform:translate3d(0,0,0) scale(1.05);animation-duration:4.7s;animation-delay:-1.2s}
@keyframes sceneSparkleTwinkle{0%{opacity:.18;transform:translate3d(-4px,2px,0) scale(1)}45%{opacity:.72}100%{opacity:.32;transform:translate3d(5px,-3px,0) scale(1.02)}}
.scene-visual-effect--snow:before,.scene-visual-effect--snow:after{content:"";position:absolute;inset:-40% -8% -10%;background-image:radial-gradient(circle,rgba(255,255,255,.9) 0 1px,transparent 2px),radial-gradient(circle,rgba(219,234,254,.78) 0 1.5px,transparent 3px),radial-gradient(circle,rgba(255,255,255,.62) 0 2px,transparent 4px);background-size:90px 90px,140px 130px,220px 190px;background-position:12px 8px,65px 42px,120px 90px;opacity:.74;animation:sceneSnowFall 14s linear infinite}.scene-visual-effect--snow:after{opacity:.42;filter:blur(.6px);animation-duration:22s;animation-delay:-9s}@keyframes sceneSnowFall{from{transform:translate3d(-2%,-16%,0)}to{transform:translate3d(3%,24%,0)}}
.scene-visual-effect--fog:before,.scene-visual-effect--fog:after{content:"";position:absolute;inset:-24%;background:radial-gradient(ellipse at 18% 48%,rgba(226,232,240,.24),transparent 34%),radial-gradient(ellipse at 56% 42%,rgba(203,213,225,.20),transparent 32%),radial-gradient(ellipse at 88% 58%,rgba(226,232,240,.18),transparent 36%),linear-gradient(90deg,transparent,rgba(226,232,240,.13),transparent);filter:blur(18px);opacity:.78;animation:sceneFogDrift 18s ease-in-out infinite alternate}.scene-visual-effect--fog:after{opacity:.45;animation-duration:26s;animation-delay:-7s;transform:scale(1.2)}@keyframes sceneFogDrift{from{transform:translate3d(-8%,2%,0) scale(1.05)}to{transform:translate3d(8%,-2%,0) scale(1.18)}}
.scene-visual-effect--hearts:before,.scene-visual-effect--hearts:after{content:"";position:absolute;inset:-18% 0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='30' viewBox='0 0 34 30'%3E%3Cpath fill='%23fb7185' fill-opacity='.72' d='M17 28S2 19 2 9.6C2 4.7 5.4 2 9.2 2c2.6 0 5 1.5 6.3 3.8C16.9 3.5 19.3 2 21.9 2 25.7 2 29 4.7 29 9.6 29 19 17 28 17 28Z'/%3E%3C/svg%3E"),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='22' viewBox='0 0 34 30'%3E%3Cpath fill='%23f472b6' fill-opacity='.64' d='M17 28S2 19 2 9.6C2 4.7 5.4 2 9.2 2c2.6 0 5 1.5 6.3 3.8C16.9 3.5 19.3 2 21.9 2 25.7 2 29 4.7 29 9.6 29 19 17 28 17 28Z'/%3E%3C/svg%3E"),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='16' viewBox='0 0 34 30'%3E%3Cpath fill='%23fecdd3' fill-opacity='.78' d='M17 28S2 19 2 9.6C2 4.7 5.4 2 9.2 2c2.6 0 5 1.5 6.3 3.8C16.9 3.5 19.3 2 21.9 2 25.7 2 29 4.7 29 9.6 29 19 17 28 17 28Z'/%3E%3C/svg%3E");background-repeat:repeat;background-size:150px 130px,210px 180px,270px 220px;background-position:12px 10px,82px 46px,142px 88px;opacity:.72;animation:sceneHeartsFloat 10s linear infinite}.scene-visual-effect--hearts:after{background-size:230px 190px,310px 260px,360px 300px;opacity:.42;filter:blur(.15px);animation-duration:16s;animation-delay:-6s}@keyframes sceneHeartsFloat{from{transform:translate3d(-1%,20%,0)}to{transform:translate3d(2%,-24%,0)}}
.scene-visual-effect--glow:before,.scene-visual-effect--glow:after{content:"";position:absolute;inset:-16%;background:radial-gradient(circle at 50% 48%,rgba(250,250,210,.56),transparent 18%),radial-gradient(circle at 50% 50%,rgba(96,165,250,.35),transparent 42%),radial-gradient(circle at 50% 50%,rgba(255,255,255,.24),transparent 66%);mix-blend-mode:screen;opacity:.78;animation:sceneGlowPulse 4.8s ease-in-out infinite alternate}.scene-visual-effect--glow:after{filter:blur(20px);opacity:.42;animation-duration:7s}@keyframes sceneGlowPulse{from{transform:scale(.92);opacity:.42}to{transform:scale(1.08);opacity:.88}}
.scene-visual-effect--fireflies:before,.scene-visual-effect--fireflies:after{content:"";position:absolute;inset:-10%;background-image:radial-gradient(circle,rgba(254,240,138,.95) 0 2px,rgba(250,204,21,.34) 3px,transparent 8px),radial-gradient(circle,rgba(187,247,208,.9) 0 1.5px,rgba(74,222,128,.26) 3px,transparent 7px),radial-gradient(circle,rgba(255,255,255,.85) 0 1px,transparent 4px);background-size:160px 130px,230px 190px,310px 250px;background-position:24px 22px,95px 80px,180px 120px;filter:drop-shadow(0 0 8px rgba(250,204,21,.75));opacity:.62;animation:sceneFireflies 7s ease-in-out infinite alternate}.scene-visual-effect--fireflies:after{opacity:.36;animation-duration:11s;animation-delay:-4s}@keyframes sceneFireflies{from{transform:translate3d(-3%,2%,0);opacity:.24}45%{opacity:.82}to{transform:translate3d(4%,-3%,0);opacity:.52}}
.scene-visual-effect--rain:before,.scene-visual-effect--rain:after{content:"";position:absolute;inset:-30% -10%;background-image:repeating-linear-gradient(105deg,rgba(191,219,254,0) 0 16px,rgba(191,219,254,.44) 17px 19px,rgba(191,219,254,0) 20px 34px);background-size:90px 90px;opacity:.42;transform:skewX(-14deg);animation:sceneRainFall .85s linear infinite}.scene-visual-effect--rain:after{opacity:.22;filter:blur(.7px);animation-duration:1.25s}@keyframes sceneRainFall{from{background-position:0 -90px}to{background-position:0 90px}}
.scene-visual-effect--magic:before,.scene-visual-effect--magic:after{content:"";position:absolute;inset:-12%;background:radial-gradient(circle at 20% 26%,rgba(216,180,254,.9) 0 1px,transparent 7px),radial-gradient(circle at 72% 34%,rgba(125,211,252,.86) 0 2px,transparent 8px),radial-gradient(circle at 42% 72%,rgba(244,114,182,.78) 0 1.5px,transparent 7px),conic-gradient(from 90deg at 50% 50%,transparent,rgba(168,85,247,.18),transparent,rgba(14,165,233,.16),transparent);mix-blend-mode:screen;opacity:.72;animation:sceneMagicSwirl 8s ease-in-out infinite}.scene-visual-effect--magic:after{filter:blur(8px);opacity:.34;animation-duration:12s;animation-direction:reverse}@keyframes sceneMagicSwirl{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(9deg) scale(1.08)}100%{transform:rotate(0deg) scale(1)}}
.scene-visual-effect--embers:before,.scene-visual-effect--embers:after{content:"";position:absolute;inset:-14% 0;background-image:radial-gradient(circle,rgba(251,146,60,.92) 0 2px,rgba(239,68,68,.26) 3px,transparent 8px),radial-gradient(circle,rgba(254,215,170,.82) 0 1px,transparent 5px),radial-gradient(circle,rgba(248,113,113,.78) 0 1.5px,transparent 6px);background-size:120px 150px,190px 210px,260px 260px;background-position:18px 120px,76px 180px,150px 220px;filter:drop-shadow(0 0 8px rgba(249,115,22,.7));opacity:.58;animation:sceneEmbersRise 12s linear infinite}.scene-visual-effect--embers:after{opacity:.32;filter:blur(.8px);animation-duration:18s;animation-delay:-7s}@keyframes sceneEmbersRise{from{transform:translate3d(0,18%,0)}to{transform:translate3d(4%,-26%,0)}}
.scene-visual-effect--stars:before,.scene-visual-effect--stars:after{content:"";position:absolute;inset:-8%;background-image:radial-gradient(circle,rgba(255,255,255,.95) 0 1px,transparent 2px),radial-gradient(circle,rgba(191,219,254,.72) 0 1px,transparent 3px),radial-gradient(circle,rgba(250,204,21,.55) 0 1.5px,transparent 4px);background-size:80px 70px,150px 130px,240px 210px;background-position:10px 18px,70px 44px,132px 92px;opacity:.64;animation:sceneStarsTwinkle 4.4s ease-in-out infinite alternate}.scene-visual-effect--stars:after{opacity:.32;filter:blur(.5px);animation-duration:7s;animation-delay:-2s}@keyframes sceneStarsTwinkle{0%{opacity:.24;transform:scale(1)}55%{opacity:.86}100%{opacity:.38;transform:scale(1.03)}}
.scene-visual-effect--blizzard:before,.scene-visual-effect--blizzard:after{content:"";position:absolute;inset:-50% -18%;background-image:radial-gradient(circle,rgba(255,255,255,.9) 0 1.5px,transparent 3px),radial-gradient(circle,rgba(219,234,254,.72) 0 2px,transparent 4px);background-size:55px 55px,95px 85px;opacity:.76;transform:skewX(-14deg);animation:sceneBlizzard 4.2s linear infinite}.scene-visual-effect--blizzard:after{opacity:.42;filter:blur(1px);animation-duration:6s;animation-delay:-2s}@keyframes sceneBlizzard{from{background-position:-120px -120px;transform:translate3d(-10%,-20%,0) skewX(-14deg)}to{background-position:120px 120px;transform:translate3d(12%,22%,0) skewX(-14deg)}}
.scene-visual-effect--smoke:before,.scene-visual-effect--smoke:after{content:"";position:absolute;inset:-24%;background:radial-gradient(ellipse at 24% 70%,rgba(148,163,184,.28),transparent 34%),radial-gradient(ellipse at 56% 78%,rgba(71,85,105,.32),transparent 36%),radial-gradient(ellipse at 82% 68%,rgba(203,213,225,.18),transparent 30%);filter:blur(20px);opacity:.7;animation:sceneSmokeCurl 15s ease-in-out infinite alternate}.scene-visual-effect--smoke:after{opacity:.42;animation-duration:22s;animation-delay:-8s}@keyframes sceneSmokeCurl{from{transform:translate3d(-5%,8%,0) scale(1)}to{transform:translate3d(6%,-8%,0) scale(1.18)}}
.scene-visual-effect--storm:before{content:"";position:absolute;inset:-30% -10%;background-image:repeating-linear-gradient(105deg,rgba(147,197,253,0) 0 12px,rgba(147,197,253,.34) 13px 16px,rgba(147,197,253,0) 17px 30px);background-size:70px 80px;opacity:.5;animation:sceneRainFall .62s linear infinite}.scene-visual-effect--storm:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 0 46%,rgba(255,255,255,.9) 47%,rgba(147,197,253,.25) 49%,transparent 52% 100%);opacity:0;animation:sceneLightning 5.8s steps(1,end) infinite}@keyframes sceneLightning{0%,88%,94%,100%{opacity:0}89%{opacity:.85}90%{opacity:.12}92%{opacity:.62}}
.scene-visual-effect--flames:before,.scene-visual-effect--flames:after{content:"";position:absolute;inset:38% -8% -20%;background:radial-gradient(ellipse at 20% 100%,rgba(239,68,68,.62),transparent 38%),radial-gradient(ellipse at 44% 92%,rgba(249,115,22,.72),transparent 34%),radial-gradient(ellipse at 64% 100%,rgba(253,224,71,.45),transparent 28%),radial-gradient(ellipse at 84% 96%,rgba(220,38,38,.5),transparent 36%);filter:blur(8px);mix-blend-mode:screen;opacity:.72;animation:sceneFlames 2.2s ease-in-out infinite alternate}.scene-visual-effect--flames:after{opacity:.38;filter:blur(18px);animation-duration:3.6s;animation-delay:-1.4s}@keyframes sceneFlames{from{transform:translate3d(-2%,2%,0) scaleY(.94)}to{transform:translate3d(2%,-4%,0) scaleY(1.08)}}
.scene-visual-effect--bubbles:before,.scene-visual-effect--bubbles:after{content:"";position:absolute;inset:-12%;background-image:radial-gradient(circle,rgba(186,230,253,.18) 0 8px,rgba(186,230,253,.72) 9px 10px,transparent 11px),radial-gradient(circle,rgba(224,242,254,.16) 0 5px,rgba(224,242,254,.62) 6px 7px,transparent 8px);background-size:150px 160px,230px 220px;background-position:18px 130px,110px 190px;opacity:.7;animation:sceneBubblesRise 13s linear infinite}.scene-visual-effect--bubbles:after{opacity:.36;filter:blur(.4px);animation-duration:19s;animation-delay:-7s}@keyframes sceneBubblesRise{from{transform:translate3d(0,18%,0)}to{transform:translate3d(3%,-24%,0)}}
.scene-visual-effect--aurora:before,.scene-visual-effect--aurora:after{content:"";position:absolute;inset:-22%;background:conic-gradient(from 180deg at 50% 38%,transparent,rgba(34,211,238,.28),rgba(74,222,128,.22),rgba(168,85,247,.24),transparent);filter:blur(22px);mix-blend-mode:screen;opacity:.68;animation:sceneAuroraWave 11s ease-in-out infinite alternate}.scene-visual-effect--aurora:after{opacity:.38;animation-duration:17s;animation-delay:-6s}@keyframes sceneAuroraWave{from{transform:translate3d(-8%,-4%,0) rotate(-4deg) scale(1.05)}to{transform:translate3d(8%,3%,0) rotate(5deg) scale(1.18)}}
.scene-visual-effect--vignette:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,transparent 0 42%,rgba(2,6,23,.42) 72%,rgba(0,0,0,.72) 100%);opacity:.85}
.scene-visual-effect--scanlines:before,.scene-visual-effect--scanlines:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 2px 5px);opacity:.32;animation:sceneScanlines 1.2s linear infinite}.scene-visual-effect--scanlines:after{background:linear-gradient(90deg,rgba(239,68,68,.09),transparent 35%,rgba(59,130,246,.09));mix-blend-mode:screen;opacity:.5;animation:none}@keyframes sceneScanlines{from{background-position:0 0}to{background-position:0 10px}}
.scene-visual-effect--glitch:before,.scene-visual-effect--glitch:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(239,68,68,.18),transparent 22%,rgba(14,165,233,.16)),repeating-linear-gradient(0deg,transparent 0 18px,rgba(255,255,255,.14) 19px 21px,transparent 22px 42px);mix-blend-mode:screen;opacity:.36;animation:sceneGlitch 2.8s steps(2,end) infinite}.scene-visual-effect--glitch:after{background:linear-gradient(90deg,rgba(14,165,233,.16),transparent,rgba(244,63,94,.18));animation-delay:-1.3s}@keyframes sceneGlitch{0%,82%,100%{transform:translate3d(0,0,0);opacity:.18}84%{transform:translate3d(-10px,0,0);opacity:.64}86%{transform:translate3d(8px,0,0);opacity:.3}88%{transform:translate3d(0,0,0);opacity:.5}}
.scene-visual-effect--confetti:before,.scene-visual-effect--confetti:after{content:"";position:absolute;inset:-30% 0;background-image:linear-gradient(45deg,#facc15 0 6px,transparent 7px),linear-gradient(-30deg,#38bdf8 0 6px,transparent 7px),linear-gradient(20deg,#fb7185 0 6px,transparent 7px),linear-gradient(70deg,#4ade80 0 6px,transparent 7px);background-size:90px 90px,130px 130px,170px 150px,210px 190px;background-position:10px 10px,60px 40px,110px 75px,160px 120px;opacity:.58;animation:sceneConfetti 8s linear infinite}.scene-visual-effect--confetti:after{opacity:.32;animation-duration:13s;animation-delay:-5s}@keyframes sceneConfetti{from{transform:translate3d(0,-12%,0) rotate(0deg)}to{transform:translate3d(2%,24%,0) rotate(8deg)}}
.scene-visual-effect--beauty-lens{backdrop-filter:brightness(1.08) contrast(1.04) saturate(1.14) blur(.25px)}.scene-visual-effect--beauty-lens:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.16),transparent 34%),linear-gradient(180deg,rgba(244,114,182,.08),rgba(125,211,252,.08));mix-blend-mode:screen;opacity:.7}
.scene-visual-effect--dream-lens{backdrop-filter:brightness(1.08) saturate(1.28) blur(.7px)}.scene-visual-effect--dream-lens:before,.scene-visual-effect--dream-lens:after{content:"";position:absolute;inset:-16%;background:radial-gradient(circle at 24% 30%,rgba(244,114,182,.28),transparent 26%),radial-gradient(circle at 78% 34%,rgba(96,165,250,.24),transparent 30%),radial-gradient(circle at 52% 78%,rgba(250,204,21,.16),transparent 30%);mix-blend-mode:screen;opacity:.62;animation:sceneDreamLens 9s ease-in-out infinite alternate}.scene-visual-effect--dream-lens:after{filter:blur(16px);opacity:.36;animation-duration:14s;animation-delay:-5s}@keyframes sceneDreamLens{from{transform:translate3d(-3%,-2%,0) scale(1)}to{transform:translate3d(4%,3%,0) scale(1.08)}}
.scene-visual-effect--neon-lens{backdrop-filter:saturate(1.55) contrast(1.16) brightness(1.04)}.scene-visual-effect--neon-lens:before,.scene-visual-effect--neon-lens:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(236,72,153,.22),transparent 34%,rgba(34,211,238,.22)),radial-gradient(circle at 50% 50%,transparent 0 52%,rgba(14,165,233,.24) 78%,rgba(236,72,153,.26));mix-blend-mode:screen;opacity:.72}.scene-visual-effect--neon-lens:after{filter:blur(14px);opacity:.38}
.scene-visual-effect--night-vision{backdrop-filter:grayscale(1) contrast(1.42) brightness(.95) sepia(.25) hue-rotate(68deg) saturate(2.8)}.scene-visual-effect--night-vision:before,.scene-visual-effect--night-vision:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(74,222,128,.2),transparent 42%,rgba(0,0,0,.42) 100%),repeating-linear-gradient(0deg,rgba(187,247,208,.08) 0 1px,transparent 2px 5px);mix-blend-mode:screen;opacity:.72;animation:sceneScanlines 1.4s linear infinite}.scene-visual-effect--night-vision:after{background:radial-gradient(circle at 50% 50%,transparent 0 45%,rgba(0,0,0,.58) 82%,rgba(0,0,0,.82));animation:none;mix-blend-mode:multiply}
.scene-visual-effect--thermal{backdrop-filter:saturate(2.2) contrast(1.45) brightness(1.05)}.scene-visual-effect--thermal:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,rgba(14,165,233,.34),rgba(34,197,94,.22) 30%,rgba(250,204,21,.26) 52%,rgba(249,115,22,.3) 70%,rgba(239,68,68,.34)),radial-gradient(circle at 55% 42%,rgba(255,255,255,.24),transparent 22%);mix-blend-mode:color;opacity:.72}
.scene-visual-effect--comic-lens{backdrop-filter:contrast(1.34) saturate(1.55) brightness(1.03)}.scene-visual-effect--comic-lens:before,.scene-visual-effect--comic-lens:after{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(0,0,0,.18) 0 1px,transparent 1.8px);background-size:7px 7px;mix-blend-mode:multiply;opacity:.46}.scene-visual-effect--comic-lens:after{background:linear-gradient(90deg,rgba(250,204,21,.12),transparent,rgba(239,68,68,.10));mix-blend-mode:overlay;opacity:.7}
.scene-visual-effect--noir-lens{backdrop-filter:grayscale(1) contrast(1.35) brightness(.92)}.scene-visual-effect--noir-lens:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 44%,transparent 0 46%,rgba(0,0,0,.58) 86%,rgba(0,0,0,.82)),linear-gradient(180deg,rgba(255,255,255,.08),transparent 45%,rgba(0,0,0,.22));opacity:.9}
.scene-inline-viewer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;z-index:1000;pointer-events:auto}
.scene-inline-viewer__backdrop{position:absolute;inset:0;background:rgba(2,6,23,.62)}
.scene-inline-viewer__card{position:relative;z-index:1;max-width:min(86vw,760px);max-height:82%;display:flex;flex-direction:column;gap:12px;align-items:center}
.scene-inline-viewer__image{width:auto;max-width:min(82vw,720px);height:auto;max-height:68vh;object-fit:contain;border-radius:18px;background:transparent;box-shadow:0 20px 60px rgba(0,0,0,.35);display:block}
.scene-inline-viewer__name{align-self:stretch;padding:12px 16px;border-radius:16px;background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.08);font-weight:700;text-align:left;color:#fff}
.inventory-actions{margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}
button,.button-like{border:1px solid transparent;background:linear-gradient(180deg, #4f8cff 0%, #2f6fe4 100%);color:white;padding:11px 16px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 10px 24px rgba(47,111,228,.22)}
.secondary-button{background:rgba(18,31,56,.95)!important;border-color:rgba(148,163,184,.16)!important;box-shadow:none!important}
.danger-button{background:linear-gradient(180deg, #d14b4b 0%, #a92c2c 100%)!important;color:#fff;border-color:rgba(255,255,255,.06)!important;box-shadow:0 12px 24px rgba(169,44,44,.24)!important}
.badge-line{display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;background:rgba(37,99,235,.15);border:1px solid rgba(96,165,250,.3);color:#bfdbfe;margin-bottom:12px}
.dialogue-box{line-height:1.7;background:rgba(12,21,39,.92);border-radius:18px;padding:14px;border:1px solid rgba(148,163,184,.16)}
.small-note{color:#9fb0cc;font-size:13px;line-height:1.55}
.panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 12px}
.panel-head h3{margin:0}
.inventory-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}
.inventory-tile{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;border:1px solid rgba(148,163,184,.16);padding:10px;background:#1e293b;border-radius:16px;color:#fff}
.inventory-tile.selected{outline:2px solid #60a5fa;background:#1d4ed8}
.inventory-thumb{width:72px;height:72px;border-radius:14px;background:#0f172a;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:28px}
.inventory-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:20px;z-index:40}
.overlay-card{width:min(92vw,980px);max-height:90vh;overflow:auto;border-radius:24px;padding:18px;background:linear-gradient(180deg, rgba(12,20,37,.98) 0%, rgba(8,16,30,.98) 100%);border:1px solid rgba(148,163,184,.16);box-shadow:0 20px 60px rgba(0,0,0,.34)}
.overlay-media{width:100%;max-height:62vh;object-fit:contain;display:block;border-radius:16px;background:#020617}
.narration{font-size:18px;line-height:1.8}
.color-picker-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:10px}
.color-picker-button{height:52px;border-radius:14px;border:2px solid rgba(255,255,255,.18)!important}
.color-attempt-row{display:flex;gap:10px;flex-wrap:wrap;min-height:42px;align-items:center;margin-top:6px}
.color-chip{width:34px;height:34px;border-radius:999px;border:2px solid rgba(255,255,255,.28);display:inline-block}
.enigma-grid{display:grid;gap:8px;margin-top:12px}
.puzzle-piece,.puzzle-slot{aspect-ratio:1 / 1;border-radius:14px;border:1px solid rgba(255,255,255,.12);background-color:#0b1324;background-repeat:no-repeat;background-origin:border-box;overflow:hidden}
.puzzle-piece.selected{outline:3px solid #60a5fa;transform:scale(.97)}
.puzzle-piece.static{display:block;width:100%;height:100%;pointer-events:none}
.puzzle-slot{padding:0;display:flex;align-items:center;justify-content:center;background:#020617}
.slot-index{color:#64748b;font-weight:700}
.dragdrop-layout{display:grid;grid-template-columns:2fr 1fr;gap:18px;align-items:start}
.bank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.simon-grid .simon-pad{min-height:110px;font-size:28px;font-weight:800;color:rgba(255,255,255,.85)}
.simon-pad.active{box-shadow:0 0 0 4px rgba(255,255,255,.38),0 0 36px rgba(255,255,255,.45);transform:scale(1.04)}
@media (max-width:1200px){.layout{grid-template-columns:1fr}}
@media (max-width:900px){.app-shell{padding:18px}.topbar{flex-direction:column}.topbar h1{font-size:32px}.dragdrop-layout{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="app-shell">
  <div class="topbar">
    <div class="brand-block">
      <div class="status-badge">🎮 Export prêt à jouer</div>
      <h1>${safeTitle}</h1>
      <p>Version standalone générée depuis le preview du builder.</p>
    </div>
    <div class="topbar-actions">
      <button id="save-game" class="fullscreen-toggle" type="button">Sauvegarder</button>
      <button id="load-game" class="fullscreen-toggle" type="button">Charger</button>
      <button id="delete-save" class="fullscreen-toggle" type="button">Effacer sauvegarde</button>
      <button id="fullscreen-toggle" class="fullscreen-toggle" type="button">Plein ?cran</button>
      <span id="save-status" class="small-note" style="align-self:center"></span>
    </div>
  </div>
  <div id="game-root"></div>
</div>

<script>
const project = ${serializedProject};
const root = document.getElementById('game-root');
let hasRenderedOnce = false;
let sceneTransitionTimer = null;
let sceneTimerInterval = null;
let activeSceneTimerKey = '';
let expiredSceneTimerKey = '';

const PREVIEW_COLOR_OPTIONS = ${serializedColorOptions};
const POPUP_OVERLAY_GRADIENTS = ${serializedPopupOverlayGradients};
const CODE_KEYPAD_KEYS = ${serializedCodeKeypadKeys};

const DEFAULT_STATE = () => {
  const start = project.start || { type: 'scene', targetSceneId: project.scenes?.[0]?.id || '', targetCinematicId: '' };
  const initialScene = project.scenes.find((scene) => scene.id === start.targetSceneId) || project.scenes[0] || null;
  const initialCinematic = start.type === 'cinematic' && start.targetCinematicId ?
     (project.cinematics || []).find((entry) => entry.id === start.targetCinematicId) || null
    : null;

  return {
    playSceneId: initialScene?.id || '',
    inventory: [],
    playerLives: 3,
    dialogue: initialScene?.introText || '',
    viewerImage: null,
    playingCinematicId: initialCinematic?.id || null,
    playingSlideIndex: 0,
    selectedInventoryIds: [],
    draggedInventoryId: null,
    inventoryDrawerOpen: false,
    activeEnigma: null,
    enigmaCodeInput: '',
    enigmaColorAttempt: [],
    enigmaPuzzleOrder: [],
    enigmaPuzzleSelectedIndex: null,
    enigmaDragBank: [],
    enigmaDragSlots: [],
    enigmaDraggedPiece: null,
    enigmaRotationAngles: [],
    completedHotspotIds: [],
    solvedEnigmaIds: [],
    launchedCinematicIds: initialCinematic?.id ? [initialCinematic.id] : [],
    completedCombinationIds: [],
    usedLogicRuleIds: [],
    removedSceneObjectIds: [],
    sceneTransitionOverlay: null,
    sceneTimerRemaining: 0,
    simonPlaybackIndex: -1,
    simonPlayerTurn: false,
  };
};


function updateSaveStatus(message = '') {
  const status = document.getElementById('save-status');
  if (status) status.textContent = message;
}

const state = DEFAULT_STATE();

const SAVE_STORAGE_KEY = 'escapeGameSave:' + String(project?.id || project?.title || 'default');

function getSerializableState() {
  return {
    playSceneId: state.playSceneId,
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    dialogue: state.dialogue || '',
    viewerImage: state.viewerImage || null,
    playerLives: Number.isFinite(Number(state.playerLives)) ? Number(state.playerLives) : 3,
    playingCinematicId: state.playingCinematicId || null,
    playingSlideIndex: Number(state.playingSlideIndex) || 0,
    selectedInventoryIds: Array.isArray(state.selectedInventoryIds) ? state.selectedInventoryIds : [],
    completedHotspotIds: Array.isArray(state.completedHotspotIds) ? state.completedHotspotIds : [],
    solvedEnigmaIds: Array.isArray(state.solvedEnigmaIds) ? state.solvedEnigmaIds : [],
    launchedCinematicIds: Array.isArray(state.launchedCinematicIds) ? state.launchedCinematicIds : [],
    completedCombinationIds: Array.isArray(state.completedCombinationIds) ? state.completedCombinationIds : [],
    usedLogicRuleIds: Array.isArray(state.usedLogicRuleIds) ? state.usedLogicRuleIds : [],
    removedSceneObjectIds: Array.isArray(state.removedSceneObjectIds) ? state.removedSceneObjectIds : [],
  };
}

function saveGame(manual = false) {
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(getSerializableState()));
    updateSaveStatus(manual ? 'Sauvegard?.' : '');
    if (manual) {
      state.dialogue = 'Partie sauvegardée.';
      render(false);
    }
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde', error);
    updateSaveStatus('Sauvegarde impossible.');
    if (manual) {
      state.dialogue = 'Impossible de sauvegarder la partie.';
      render(false);
    }
    return false;
  }
}

function loadGame(manual = false) {
  try {
    const rawSave = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!rawSave) {
      updateSaveStatus('Aucune sauvegarde.');
      if (manual) {
        state.dialogue = 'Aucune sauvegarde trouvée.';
        render(false);
      }
      return false;
    }

    const savedState = JSON.parse(rawSave);
    stopSceneTimer();
    expiredSceneTimerKey = '';
    Object.assign(state, DEFAULT_STATE(), savedState, {
      inventory: Array.isArray(savedState.inventory) ? savedState.inventory : [],
      playerLives: Number.isFinite(Number(savedState.playerLives)) ? Math.max(0, Number(savedState.playerLives)) : 3,
      selectedInventoryIds: Array.isArray(savedState.selectedInventoryIds) ? savedState.selectedInventoryIds : [],
      completedHotspotIds: Array.isArray(savedState.completedHotspotIds) ? savedState.completedHotspotIds : [],
      solvedEnigmaIds: Array.isArray(savedState.solvedEnigmaIds) ? savedState.solvedEnigmaIds : [],
      launchedCinematicIds: Array.isArray(savedState.launchedCinematicIds) ? savedState.launchedCinematicIds : [],
      completedCombinationIds: Array.isArray(savedState.completedCombinationIds) ? savedState.completedCombinationIds : [],
      usedLogicRuleIds: Array.isArray(savedState.usedLogicRuleIds) ? savedState.usedLogicRuleIds : [],
      removedSceneObjectIds: Array.isArray(savedState.removedSceneObjectIds) ? savedState.removedSceneObjectIds : [],
      inventoryDrawerOpen: false,
      activeEnigma: null,
      enigmaCodeInput: '',
      enigmaColorAttempt: [],
      enigmaPuzzleOrder: [],
      enigmaPuzzleSelectedIndex: null,
      enigmaDragBank: [],
      enigmaDragSlots: [],
      enigmaDraggedPiece: null,
      enigmaRotationAngles: [],
      sceneTimerRemaining: 0,
      simonPlaybackIndex: -1,
      simonPlayerTurn: false,
    });
    updateSaveStatus('Charg?.');

    if (manual) {
      state.dialogue = 'Sauvegarde chargée.';
    }

    render(false);
    return true;
  } catch (error) {
    console.error('Erreur chargement sauvegarde', error);
    updateSaveStatus('Chargement impossible.');
    if (manual) {
      state.dialogue = 'Impossible de charger cette sauvegarde.';
      render(false);
    }
    return false;
  }
}

function deleteSave(manual = false) {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
    localStorage.removeItem(SAVE_STORAGE_KEY + ':name');
    localStorage.removeItem(SAVE_STORAGE_KEY + ':lastPayload');
    updateSaveStatus(manual ? 'Sauvegarde supprimée.' : '');
    if (manual) state.dialogue = 'Sauvegarde supprimée.';
  } catch (error) {
    console.error('Erreur suppression sauvegarde', error);
    updateSaveStatus('Suppression impossible.');
    if (manual) state.dialogue = 'Impossible de supprimer la sauvegarde.';
  }
  if (manual) render(false);
}

function clearGameSave() {
  deleteSave(true);
}

function buildSavePayload(saveName = '') {
  return {
    type: 'escape-game-save',
    version: 1,
    name: String(saveName || '').trim() || 'Sauvegarde',
    projectId: String(project?.id || ''),
    projectTitle: String(project?.title || ''),
    exportedAt: new Date().toISOString(),
    state: getSerializableState(),
  };
}

function safeSaveFilename(value = 'sauvegarde') {
  return String(value || 'sauvegarde')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'sauvegarde';
}

function downloadSaveFile(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeSaveFilename(payload.name) + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportSaveAsJson() {
  const defaultName = localStorage.getItem(SAVE_STORAGE_KEY + ':name') || 'Sauvegarde';
  const saveName = window.prompt('Nom de la sauvegarde · exporter :', defaultName);
  if (saveName === null) return;

  const payload = buildSavePayload(saveName);
  try {
    localStorage.setItem(SAVE_STORAGE_KEY + ':name', payload.name);
  } catch (error) {
    console.warn('Nom non enregistré localement', error);
  }

  downloadSaveFile(payload);
  state.dialogue = 'Sauvegarde exportée : ' + payload.name + '.';
  render(false);
}

function renameCurrentSave() {
  const currentName = localStorage.getItem(SAVE_STORAGE_KEY + ':name') || 'Sauvegarde';
  const nextName = window.prompt('Nouveau nom de la sauvegarde :', currentName);
  if (nextName === null) return;

  const cleanName = String(nextName).trim() || 'Sauvegarde';
  try {
    localStorage.setItem(SAVE_STORAGE_KEY + ':name', cleanName);

    const rawSave = localStorage.getItem(SAVE_STORAGE_KEY);
    if (rawSave) {
      const payload = buildSavePayload(cleanName);
      localStorage.setItem(SAVE_STORAGE_KEY + ':lastPayload', JSON.stringify(payload));
    }

    state.dialogue = 'Sauvegarde renommée : ' + cleanName + '.';
  } catch (error) {
    console.error('Erreur renommage sauvegarde', error);
    state.dialogue = 'Impossible de renommer la sauvegarde localement.';
  }
  render(false);
}

function normalizeImportedSave(data) {
  if (!data || typeof data !== 'object') return null;

  // Format v5 : fichier complet avec métadonnées.
  if (data.type === 'escape-game-save' && data.state && typeof data.state === 'object') {
    return {
      name: String(data.name || 'Sauvegarde importée'),
      state: data.state,
    };
  }

  // Compatibilit? : si l'utilisateur importe directement un ancien state.
  if (data.playSceneId || Array.isArray(data.inventory) || Array.isArray(data.completedHotspotIds)) {
    return {
      name: 'Sauvegarde importée',
      state: data,
    };
  }

  return null;
}

function importSaveFromJsonFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || '{}'));
      const imported = normalizeImportedSave(data);

      if (!imported) {
        state.dialogue = 'Ce fichier ne ressemble pas · une sauvegarde valide.';
        render(false);
        return;
      }

      const importedState = imported.state || {};
      stopSceneTimer();
      expiredSceneTimerKey = '';
      Object.assign(state, DEFAULT_STATE(), importedState);

      try {
        localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(getSerializableState()));
        localStorage.setItem(SAVE_STORAGE_KEY + ':name', imported.name || 'Sauvegarde importée');
      } catch (storageError) {
        console.warn('Sauvegarde locale impossible après import', storageError);
      }

      state.dialogue = 'Sauvegarde importée : ' + (imported.name || 'Sauvegarde importée') + '.';
      render(false);
    } catch (error) {
      console.error('Erreur import sauvegarde', error);
      state.dialogue = 'Impossible de lire ce fichier JSON.';
      render(false);
    }
  };

  reader.onerror = () => {
    state.dialogue = 'Impossible d’ouvrir ce fichier.';
    render(false);
  };

  reader.readAsText(file);
}

loadGame(false);
const sceneAudio = new Audio();
sceneAudio.preload = 'auto';
let sceneAudioSource = '';
const hotspotAudio = new Audio();
hotspotAudio.preload = 'auto';
let cinematicAudio = null;
let simonTimeouts = [];

function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

function syncFullscreenUi() {
  document.body.classList.toggle('game-fullscreen', isFullscreenActive());
  const button = document.getElementById('fullscreen-toggle');
  if (button) {
    button.textContent = isFullscreenActive() ? 'Quitter le plein ?cran' : 'Plein ?cran';
  }
}

function setSceneAspectFromImage(image) {
  if (!image?.naturalWidth || !image?.naturalHeight || !image.parentElement) return;
  image.parentElement.style.setProperty('--scene-aspect', String(image.naturalWidth / image.naturalHeight));
}

function getVisualEffectZoneZIndex(layer) {
  if (layer === 'front') return 26;
  if (layer === 'between') return 19;
  return 13;
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    document.body.classList.toggle('game-fullscreen');
    syncFullscreenUi();
  }
}

document.addEventListener('fullscreenchange', syncFullscreenUi);

function safeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

${standaloneGameEngineScript}

function makePieceStyle(imageData, rows, cols, pieceIndex, rotation = 0) {
  const row = Math.floor(pieceIndex / cols);
  const col = pieceIndex % cols;
  return [
    'background-image:url(' + imageData + ')',
    'background-size:' + (cols * 100) + '% ' + (rows * 100) + '%',
    'background-position:' + (cols === 1 ? 0 : (col / (cols - 1)) * 100) + '% ' + (rows === 1 ? 0 : (row / (rows - 1)) * 100) + '%',
    'transform:rotate(' + rotation + 'deg)',
  ].join(';');
}

function getItemById(id) {
  return project.items.find((item) => item.id === id) || null;
}

function getSceneById(id) {
  return project.scenes.find((scene) => scene.id === id) || null;
}

function getActById(id) {
  return (project.acts || []).find((act) => act.id === id) || null;
}

function getSceneLabel(id) {
  const scene = getSceneById(id);
  if (!scene) return 'Aucune scène';
  const act = getActById(scene.actId);
  return (act?.name ? act.name + ' · ' : '') + (scene.parentSceneId ? 'Sous-scène · ' : 'Scène · ') + scene.name;
}

function getCinematicById(id) {
  return (project.cinematics || []).find((entry) => entry.id === id) || null;
}

function getEnigmaById(id) {
  return (project.enigmas || []).find((entry) => entry.id === id) || null;
}

function getCombinationForItems(firstId, secondId) {
  if (!firstId || !secondId) return null;
  return (project.combinations || []).find((combo) => (
    (combo.itemAId === firstId && combo.itemBId === secondId)
    || (combo.itemAId === secondId && combo.itemBId === firstId)
  )) || null;
}

function getPlayScene() {
  return getSceneById(state.playSceneId) || project.scenes[0] || null;
}

function getCurrentCinematic() {
  return state.playingCinematicId ? getCinematicById(state.playingCinematicId) : null;
}

function getCurrentSlide() {
  const cinematic = getCurrentCinematic();
  return cinematic?.slides?.[state.playingSlideIndex] || null;
}

function getFirstSceneForAct(actId) {
  if (!actId) return null;
  const actScenes = project.scenes.filter((scene) => scene.actId === actId);
  if (!actScenes.length) return null;
  return actScenes.find((scene) => !scene.parentSceneId) || actScenes[0];
}

function goToScene(sceneId, fallbackText = 'Nouvelle scène.') {
  const nextScene = getSceneById(sceneId);
  if (!nextScene) return false;
  const currentScene = getPlayScene();
  const transition = currentScene?.sceneTransition || 'none';
  if (currentScene?.id && currentScene.id !== nextScene.id && transition !== 'none') {
    state.sceneTransitionOverlay = {
      type: transition,
      duration: Number(currentScene.sceneTransitionDuration) || 700,
      scene: currentScene,
    };
  }
  if (currentScene?.id !== nextScene.id) expiredSceneTimerKey = '';
  state.playSceneId = nextScene.id;
  state.dialogue = nextScene.introText || fallbackText;
  return true;
}

function toggleInventorySelection(itemId) {
  const exists = state.selectedInventoryIds.includes(itemId);
  if (exists) {
    state.selectedInventoryIds = state.selectedInventoryIds.filter((id) => id !== itemId);
    return;
  }
  if (state.selectedInventoryIds.length >= 2) {
    state.selectedInventoryIds = [state.selectedInventoryIds[1], itemId];
    return;
  }
  state.selectedInventoryIds = [...state.selectedInventoryIds, itemId];
}

function playSceneMusic() {
  const playScene = getPlayScene();
  const nextMusicData = playScene?.musicData || '';
  if (!nextMusicData) {
    sceneAudio.pause();
    sceneAudio.removeAttribute('src');
    sceneAudio.load();
    sceneAudioSource = '';
    return;
  }

  if (sceneAudioSource !== nextMusicData) {
    sceneAudio.pause();
    sceneAudio.currentTime = 0;
    sceneAudio.src = nextMusicData;
    sceneAudioSource = nextMusicData;
  }
  sceneAudio.loop = playScene.musicLoop !== false;
  sceneAudio.volume = typeof playScene.musicVolume === 'number' ? playScene.musicVolume : 0.5;
  sceneAudio.play().catch(() => {});
}

function playHotspotSound(spot) {
  if (!spot?.soundData) return;
  hotspotAudio.pause();
  hotspotAudio.currentTime = 0;
  hotspotAudio.src = spot.soundData;
  hotspotAudio.volume = typeof spot.soundVolume === 'number' ? spot.soundVolume : 0.8;
  hotspotAudio.play().catch(() => {});
}

function formatSceneTimerSeconds(seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(remaining).padStart(2, '0');
}

function stopSceneTimer() {
  if (sceneTimerInterval) {
    clearInterval(sceneTimerInterval);
    sceneTimerInterval = null;
  }
  activeSceneTimerKey = '';
}

function updateSceneTimerHud(seconds) {
  const node = document.getElementById('scene-timer-count');
  if (node) node.textContent = formatSceneTimerSeconds(seconds);
}

function applySceneTimerEnd(scene) {
  if (!scene) return;
  const action = scene.timerEndAction || 'none';
  const message = scene.timerEndMessage || 'Le temps est ecoule.';

  if (action === 'scene' && scene.timerTargetSceneId) {
    goToScene(scene.timerTargetSceneId, message);
    render();
    return;
  }

  if (action === 'restart-scene') {
    expiredSceneTimerKey = '';
    goToScene(scene.id, message || scene.introText || 'La scene recommence.');
    render();
    return;
  }

  if (action === 'restart-preview') {
    resetPreview();
    state.dialogue = message || 'Le jeu recommence.';
    render(false);
    return;
  }

  if (action === 'damage-life') {
    const loss = Math.max(1, Number(scene.timerLifeLoss) || 1);
    state.playerLives = Math.max(0, (Number(state.playerLives) || 0) - loss);
    state.dialogue = message || ('Temps ecoule: -' + loss + ' vie' + (loss > 1 ? 's' : '') + '.');
    if (state.playerLives <= 0 && scene.timerTargetSceneId) {
      goToScene(scene.timerTargetSceneId, state.dialogue);
    }
    render();
    return;
  }

  if (action === 'dialogue') {
    state.dialogue = message || 'Le temps est ecoule.';
    render();
    return;
  }

  if (action === 'cinematic' && scene.timerTargetCinematicId) {
    if (message) state.dialogue = message;
    launchCinematic(scene.timerTargetCinematicId);
    render();
    return;
  }

  if (message) {
    state.dialogue = message;
    render();
  }
}

function scheduleSceneTimer() {
  const scene = getPlayScene();
  const timerSeconds = Number(scene?.timerSeconds) || 0;
  if (!scene?.timerEnabled || timerSeconds <= 0) {
    stopSceneTimer();
    return;
  }

  const timerKey = [
    scene.id,
    timerSeconds,
    scene.timerEndAction || 'none',
    scene.timerTargetSceneId || '',
    scene.timerTargetCinematicId || '',
  ].join(':');

  if (activeSceneTimerKey === timerKey && sceneTimerInterval) {
    updateSceneTimerHud(state.sceneTimerRemaining);
    return;
  }

  if (expiredSceneTimerKey === timerKey) {
    updateSceneTimerHud(0);
    return;
  }

  stopSceneTimer();
  activeSceneTimerKey = timerKey;
  state.sceneTimerRemaining = timerSeconds;
  updateSceneTimerHud(state.sceneTimerRemaining);

  sceneTimerInterval = setInterval(() => {
    state.sceneTimerRemaining = Math.max(0, (Number(state.sceneTimerRemaining) || 0) - 1);
    updateSceneTimerHud(state.sceneTimerRemaining);
    if (state.sceneTimerRemaining <= 0) {
      expiredSceneTimerKey = activeSceneTimerKey;
      stopSceneTimer();
      applySceneTimerEnd(scene);
    }
  }, 1000);
}

function clearSimonPlayback() {
  simonTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  simonTimeouts = [];
  state.simonPlaybackIndex = -1;
}

function startSimonPlayback(enigma) {
  clearSimonPlayback();
  state.simonPlayerTurn = false;
  state.enigmaColorAttempt = [];
  const sequence = enigma.solutionColors || [];
  sequence.forEach((color, index) => {
    const showId = window.setTimeout(() => {
      state.simonPlaybackIndex = index;
      render();
    }, index * 800 + 250);
    const hideId = window.setTimeout(() => {
      state.simonPlaybackIndex = -1;
      render();
    }, index * 800 + 700);
    simonTimeouts.push(showId, hideId);
  });
  const endId = window.setTimeout(() => {
    state.simonPlaybackIndex = -1;
    state.simonPlayerTurn = true;
    render();
  }, sequence.length * 800 + 750);
  simonTimeouts.push(endId);
}

function launchCinematic(cinematicId) {
  const cinematic = getCinematicById(cinematicId);
  if (!cinematic) return;
  if (!state.launchedCinematicIds.includes(cinematic.id)) {
    state.launchedCinematicIds = [...state.launchedCinematicIds, cinematic.id];
  }
  state.playingCinematicId = cinematic.id;
  state.playingSlideIndex = 0;
}

function markHotspotCompleted(hotspotId) {
  if (!hotspotId || state.completedHotspotIds.includes(hotspotId)) return;
  state.completedHotspotIds = [...state.completedHotspotIds, hotspotId];
}

function markLogicRuleUsed(ruleId) {
  if (!ruleId || state.usedLogicRuleIds.includes(ruleId)) return;
  state.usedLogicRuleIds = [...state.usedLogicRuleIds, ruleId];
}

function resolveHotspotInteraction(spot) {
  if (!spot) return null;
  const usedRule = (spot.logicRules || []).find((rule) => rule.disableAfterUse && state.usedLogicRuleIds.includes(rule.id));
  const matchingRule = (spot.logicRules || []).find((rule) => {
    if (rule.disableAfterUse && state.usedLogicRuleIds.includes(rule.id)) return false;
    if (rule.conditionType === 'missing_item') return rule.itemId && !state.inventory.includes(rule.itemId);
    if (rule.conditionType === 'completed_hotspot') return rule.hotspotId && state.completedHotspotIds.includes(rule.hotspotId);
    if (rule.conditionType === 'solved_enigma') return rule.conditionEnigmaId && state.solvedEnigmaIds.includes(rule.conditionEnigmaId);
    if (rule.conditionType === 'launched_cinematic') return rule.cinematicId ?
       state.launchedCinematicIds.includes(rule.cinematicId)
      : state.launchedCinematicIds.length > 0;
    if (rule.conditionType === 'completed_combination') return rule.combinationId && state.completedCombinationIds.includes(rule.combinationId);
    if (rule.conditionType === 'second_click') return state.completedHotspotIds.includes(spot.id);
    return rule.itemId && state.inventory.includes(rule.itemId);
  });

  if (matchingRule) {
    const useDefaultAction = matchingRule.actionType === 'default';
    return {
      ...spot,
      actionType: useDefaultAction ? spot.actionType : matchingRule.actionType || 'dialogue',
      dialogue: matchingRule.dialogue || spot.dialogue || '',
      requiredItemId: matchingRule.conditionType === 'has_item' ? matchingRule.itemId || '' : '',
      consumeRequiredItemOnUse: Boolean(matchingRule.consumeRequiredItemOnUse),
      rewardItemId: matchingRule.rewardItemId || (useDefaultAction ? spot.rewardItemId || '' : ''),
      targetSceneId: useDefaultAction ? spot.targetSceneId || '' : matchingRule.targetSceneId || '',
      targetCinematicId: useDefaultAction ? spot.targetCinematicId || '' : matchingRule.targetCinematicId || '',
      enigmaId: useDefaultAction ? spot.enigmaId || '' : matchingRule.enigmaId || '',
      objectImageData: useDefaultAction ? spot.objectImageData || '' : matchingRule.objectImageData || '',
      objectImageName: useDefaultAction ? spot.objectImageName || '' : matchingRule.objectImageName || '',
      logicRuleId: matchingRule.id || '',
      disableAfterUse: Boolean(matchingRule.disableAfterUse),
    };
  }

  const useSecondAction = Boolean(spot.hasSecondAction && state.completedHotspotIds.includes(spot.id));
  if (!useSecondAction) {
    return usedRule?.conditionType === 'has_item' ? {
      ...spot,
      requiredItemId: '',
      consumeRequiredItemOnUse: false,
    } : spot;
  }
  return {
    ...spot,
    actionType: spot.secondActionType || 'dialogue',
    dialogue: spot.secondDialogue || '',
    requiredItemId: spot.secondRequiredItemId || '',
    consumeRequiredItemOnUse: Boolean(spot.secondConsumeRequiredItemOnUse),
    rewardItemId: spot.secondRewardItemId || '',
    targetSceneId: spot.secondTargetSceneId || '',
    targetCinematicId: spot.secondTargetCinematicId || '',
    enigmaId: spot.secondEnigmaId || '',
    objectImageData: spot.secondObjectImageData || '',
    objectImageName: spot.secondObjectImageName || '',
  };
}

function applyHotspotSideEffects(spot, sourceHotspotId = spot?.id) {
  if (!spot) return;

  if (spot.consumeRequiredItemOnUse && spot.requiredItemId) {
    const nextInventory = [...state.inventory];
    const usedIndex = nextInventory.indexOf(spot.requiredItemId);
    if (usedIndex >= 0) nextInventory.splice(usedIndex, 1);
    state.inventory = nextInventory;
    state.selectedInventoryIds = state.selectedInventoryIds.filter((id) => id !== spot.requiredItemId);
    if (state.viewerImage?.id === spot.requiredItemId) {
      state.viewerImage = null;
    }
  }

  if (spot.objectImageData) {
    state.viewerImage = { src: spot.objectImageData, name: spot.objectImageName || spot.name };
  }

  if (spot.dialogue) state.dialogue = spot.dialogue;

  if (spot.rewardItemId && !state.inventory.includes(spot.rewardItemId)) {
    state.inventory = [...state.inventory, spot.rewardItemId];
    if (!state.selectedInventoryIds.includes(spot.rewardItemId)) {
      state.selectedInventoryIds = [...state.selectedInventoryIds, spot.rewardItemId].slice(-2);
    }
  }

  markHotspotCompleted(sourceHotspotId || spot.id);
  if (spot.disableAfterUse && spot.logicRuleId) markLogicRuleUsed(spot.logicRuleId);
}

function applyHotspotAction(spot, sourceHotspotId = spot?.id) {
  if (!spot) return;

  applyHotspotSideEffects(spot, sourceHotspotId);

  if (spot.actionType === 'scene' && spot.targetSceneId) {
    goToScene(spot.targetSceneId, spot.dialogue || 'Nouvelle scene.');
  }

  if (spot.actionType === 'cinematic' && spot.targetCinematicId) {
    launchCinematic(spot.targetCinematicId);
  }
}

function applyEnigmaSuccess(enigma, hotspot) {
  if (hotspot && enigma.unlockType !== 'none') {
    applyHotspotSideEffects(hotspot);
  }
  if (enigma.successMessage) state.dialogue = enigma.successMessage;

  if (enigma.unlockType === 'scene' && enigma.targetSceneId) {
    goToScene(enigma.targetSceneId, enigma.successMessage || 'Nouvelle scène débloquée.');
  } else if (enigma.unlockType === 'cinematic' && enigma.targetCinematicId) {
    launchCinematic(enigma.targetCinematicId);
  } else if (hotspot) {
    applyHotspotAction(hotspot);
  }
}

function closeEnigma() {
  clearSimonPlayback();
  state.activeEnigma = null;
  state.enigmaCodeInput = '';
  state.enigmaColorAttempt = [];
  state.enigmaPuzzleOrder = [];
  state.enigmaPuzzleSelectedIndex = null;
  state.enigmaDragBank = [];
  state.enigmaDragSlots = [];
  state.enigmaDraggedPiece = null;
  state.enigmaRotationAngles = [];
  state.simonPlayerTurn = false;
}

function solveActiveEnigma() {
  if (!state.activeEnigma?.enigma) return;
  const { enigma, hotspot } = state.activeEnigma;
  if (!state.solvedEnigmaIds.includes(enigma.id)) {
    state.solvedEnigmaIds = [...state.solvedEnigmaIds, enigma.id];
  }
  closeEnigma();
  applyEnigmaSuccess(enigma, hotspot);
  render();
}

function failActiveEnigma() {
  if (!state.activeEnigma?.enigma) return;
  state.dialogue = state.activeEnigma.enigma.failMessage || 'Ce n’est pas la bonne réponse.';
}

function openEnigma(enigma, hotspot = null) {
  const pieceCount = Math.max(4, (Number(enigma.gridRows) || 3) * (Number(enigma.gridCols) || 3));
  state.activeEnigma = { enigma, hotspot };
  state.enigmaCodeInput = '';
  state.enigmaColorAttempt = [];
  state.enigmaPuzzleSelectedIndex = null;
  state.enigmaDraggedPiece = null;
  state.simonPlayerTurn = enigma.type !== 'simon';

  if (enigma.type === 'puzzle') {
    state.enigmaPuzzleOrder = shuffledIndices(pieceCount);
  } else {
    state.enigmaPuzzleOrder = [];
  }

  if (enigma.type === 'dragdrop') {
    state.enigmaDragBank = shuffledIndices(pieceCount);
    state.enigmaDragSlots = Array.from({ length: pieceCount }, () => null);
  } else {
    state.enigmaDragBank = [];
    state.enigmaDragSlots = [];
  }

  if (enigma.type === 'rotation') {
    state.enigmaRotationAngles = randomRotations(pieceCount);
  } else {
    state.enigmaRotationAngles = [];
  }

  if (enigma.type === 'simon') {
    startSimonPlayback(enigma);
  } else {
    clearSimonPlayback();
  }
}

function submitEnigma() {
  if (!state.activeEnigma?.enigma) return false;
  const { enigma } = state.activeEnigma;
  const isSuccess = enigma.type === 'colors' ?
     sameColorSequence(state.enigmaColorAttempt, enigma.solutionColors || [])
    : enigma.type === 'misc' ?
       validateMiscAnswer(enigma, state.enigmaCodeInput)
      : (state.enigmaCodeInput || '').trim().toLowerCase() === (enigma.solutionText || '').trim().toLowerCase();

  if (!isSuccess) {
    failActiveEnigma();
    if (enigma.type === 'colors') state.enigmaColorAttempt = [];
    render();
    return false;
  }

  solveActiveEnigma();
  return true;
}

function pushEnigmaColor(colorValue) {
  if (!state.activeEnigma?.enigma) return;
  const expectedLength = state.activeEnigma.enigma.solutionColors?.length || 0;
  const next = [...state.enigmaColorAttempt, colorValue].slice(0, expectedLength || state.enigmaColorAttempt.length + 1);
  state.enigmaColorAttempt = next;

  if (state.activeEnigma.enigma.type === 'simon') {
    const solution = state.activeEnigma.enigma.solutionColors || [];
    const failed = next.some((color, index) => color !== solution[index]);
    if (failed) {
      state.enigmaColorAttempt = [];
      failActiveEnigma();
      startSimonPlayback(state.activeEnigma.enigma);
      render();
      return;
    }
    if (next.length === solution.length) {
      solveActiveEnigma();
      return;
    }
  }

  render();
}

function clickPuzzlePiece(index) {
  if (state.enigmaPuzzleSelectedIndex === null) {
    state.enigmaPuzzleSelectedIndex = index;
    render();
    return;
  }

  const next = [...state.enigmaPuzzleOrder];
  [next[state.enigmaPuzzleSelectedIndex], next[index]] = [next[index], next[state.enigmaPuzzleSelectedIndex]];
  state.enigmaPuzzleOrder = next;
  state.enigmaPuzzleSelectedIndex = null;
  render();

  if (next.every((value, pieceIndex) => value === pieceIndex)) {
    window.setTimeout(() => solveActiveEnigma(), 120);
  }
}

function rotatePuzzlePiece(index) {
  const next = [...state.enigmaRotationAngles];
  next[index] = (((next[index] || 0) + 90) % 360);
  state.enigmaRotationAngles = next;
  render();

  if (next.every((value) => value % 360 === 0)) {
    window.setTimeout(() => solveActiveEnigma(), 120);
  }
}

function moveDragPieceToSlot(piece, slotIndex) {
  if (piece === null || piece === undefined) return;
  const bankWithoutPiece = state.enigmaDragBank.filter((entry) => entry !== piece);
  const nextSlots = [...state.enigmaDragSlots];
  const previousSlotIndex = nextSlots.findIndex((entry) => entry === piece);
  if (previousSlotIndex >= 0) nextSlots[previousSlotIndex] = null;
  const displacedPiece = nextSlots[slotIndex];
  nextSlots[slotIndex] = piece;

  state.enigmaDragSlots = nextSlots;
  state.enigmaDragBank = displacedPiece === null || displacedPiece === undefined ?
     bankWithoutPiece
    : [...bankWithoutPiece, displacedPiece];
  render();

  if (nextSlots.every((entry, index) => entry === index)) {
    window.setTimeout(() => solveActiveEnigma(), 120);
  }
}

function returnDragPieceToBank(slotIndex) {
  const nextSlots = [...state.enigmaDragSlots];
  const piece = nextSlots[slotIndex];
  if (piece !== null && piece !== undefined) {
    nextSlots[slotIndex] = null;
    state.enigmaDragSlots = nextSlots;
    state.enigmaDragBank = [...state.enigmaDragBank, piece];
    render();
  }
}

function openInventoryItem(itemId) {
  const item = getItemById(itemId);
  if (!item) return;
  if (item.imageData) {
    state.viewerImage = { id: item.id, src: item.imageData, name: item.name };
  }
  toggleInventorySelection(itemId);
  render();
}

function combineInventoryItems(firstId, secondId) {
  const combo = getCombinationForItems(firstId, secondId);
  if (!combo?.resultItemId) {
    state.dialogue = 'Ces deux objets ne peuvent pas être combinés.';
    render();
    return false;
  }

  const remaining = [...state.inventory];
  const removeOne = (id) => {
    const index = remaining.indexOf(id);
    if (index >= 0) remaining.splice(index, 1);
  };

  removeOne(firstId);
  removeOne(secondId);
  if (!remaining.includes(combo.resultItemId)) remaining.push(combo.resultItemId);
  state.inventory = remaining;

  const resultItem = getItemById(combo.resultItemId);
  if (!state.completedCombinationIds.includes(combo.id)) {
    state.completedCombinationIds = [...state.completedCombinationIds, combo.id];
  }
  state.dialogue = combo.message || ('Tu obtiens ' + (resultItem?.name || 'un nouvel objet') + '.');
  state.selectedInventoryIds = combo.resultItemId ? [combo.resultItemId] : [];
  state.viewerImage = resultItem?.imageData ? { id: resultItem.id, src: resultItem.imageData, name: resultItem.name } : null;
  render();
  return true;
}

function triggerSceneObject(objectId) {
  const scene = getPlayScene();
  const obj = scene?.sceneObjects?.find((entry) => entry.id === objectId);
  if (!obj || state.removedSceneObjectIds.includes(obj.id)) return;

  const mode = obj.interactionMode || 'popup';
  const popupSrc = obj.popupImage || obj.imageData || '';
  const linkedItem = obj.linkedItemId ? getItemById(obj.linkedItemId) : null;

  if (mode === 'popup' || mode === 'both') {
    if (popupSrc) {
      state.viewerImage = {
        id: obj.linkedItemId || obj.id,
        src: popupSrc,
        // Ne jamais afficher le nom du fichier uploadé dans la pop-up.
        // On affiche d'abord le dialogue, sinon le nom lisible de l'objet.
        name: obj.dialogue || obj.name || linkedItem?.name || 'Objet',
      };
    }
  }

  if ((mode === 'inventory' || mode === 'both') && obj.linkedItemId) {
    if (!state.inventory.includes(obj.linkedItemId)) {
      state.inventory = [...state.inventory, obj.linkedItemId];
    }
    if (!state.selectedInventoryIds.includes(obj.linkedItemId)) {
      state.selectedInventoryIds = [...state.selectedInventoryIds, obj.linkedItemId].slice(-2);
    }
    state.dialogue = obj.dialogue || ('Tu obtiens ' + (linkedItem?.name || obj.name || 'un objet') + '.');
  } else if (obj.dialogue) {
    state.dialogue = obj.dialogue;
  }

  if (obj.removeAfterUse && !state.removedSceneObjectIds.includes(obj.id)) {
    state.removedSceneObjectIds = [...state.removedSceneObjectIds, obj.id];
  }

  render();
}

function triggerHotspot(spotId) {
  const scene = getPlayScene();
  const spot = scene?.hotspots?.find((entry) => entry.id === spotId);
  if (!spot) return;
  const activeSpot = resolveHotspotInteraction(spot);
  if (!activeSpot) return;

  if (activeSpot.requiredHotspotId && !state.completedHotspotIds.includes(activeSpot.requiredHotspotId)) {
    state.dialogue = activeSpot.lockedMessage || 'Je ne peux pas faire ?a maintenant.';
    render();
    return;
  }

  if (activeSpot.requiredItemId && !state.inventory.includes(activeSpot.requiredItemId)) {
    const need = getItemById(activeSpot.requiredItemId);
    state.dialogue = 'Il te faut ' + (need?.name || 'un objet') + ' pour faire ?a.';
    render();
    return;
  }

  playHotspotSound(activeSpot);

  if (activeSpot.enigmaId) {
    const enigma = getEnigmaById(activeSpot.enigmaId);
    if (enigma) {
      openEnigma(enigma, activeSpot);
      render();
      return;
    }
  }

  applyHotspotAction(activeSpot, spot.id);
  render();
}

function applyCinematicEnd(cinematic) {
  if (!cinematic || !cinematic.onEndType || cinematic.onEndType === 'none') return;

  if (cinematic.onEndType === 'scene' && cinematic.targetSceneId) {
    goToScene(cinematic.targetSceneId, 'Nouvelle scène débloquée.');
    return;
  }

  if (cinematic.onEndType === 'act' && cinematic.targetActId) {
    const actScene = getFirstSceneForAct(cinematic.targetActId);
    if (actScene) goToScene(actScene.id, 'Un nouvel acte commence.');
    return;
  }

  if (cinematic.onEndType === 'item' && cinematic.rewardItemId) {
    const rewardItem = getItemById(cinematic.rewardItemId);
    if (!state.inventory.includes(cinematic.rewardItemId)) {
      state.inventory = [...state.inventory, cinematic.rewardItemId];
    }
    if (!state.selectedInventoryIds.includes(cinematic.rewardItemId)) {
      state.selectedInventoryIds = [...state.selectedInventoryIds, cinematic.rewardItemId].slice(-2);
    }
    if (rewardItem?.imageData) {
      state.viewerImage = { id: rewardItem.id, src: rewardItem.imageData, name: rewardItem.name };
    }
    state.dialogue = 'Tu obtiens ' + (rewardItem?.name || 'un nouvel objet') + '.';
  }
}

function closeCinematic() {
  const cinematic = getCurrentCinematic();
  state.playingCinematicId = null;
  state.playingSlideIndex = 0;

  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }

  applyCinematicEnd(cinematic);
  render();
}

function advanceCinematic() {
  const cinematic = getCurrentCinematic();
  if (!cinematic) return;
  const total = cinematic.slides?.length || 0;
  if (state.playingSlideIndex + 1 >= total) {
    closeCinematic();
    return;
  }
  state.playingSlideIndex += 1;
  render();
}

function resetPreview() {
  stopSceneTimer();
  expiredSceneTimerKey = '';
  Object.assign(state, DEFAULT_STATE());
  state.inventoryDrawerOpen = false;
  closeEnigma();
  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }
  render();
}

function bindEvents() {
  document.getElementById('fullscreen-toggle')?.addEventListener('click', toggleFullscreen);
  document.getElementById('save-game')?.addEventListener('click', () => saveGame(true));
  document.getElementById('load-game')?.addEventListener('click', () => loadGame(true));
  document.getElementById('delete-save')?.addEventListener('click', () => deleteSave(true));
  document.getElementById('export-save-json')?.addEventListener('click', exportSaveAsJson);
  document.getElementById('import-save-json')?.addEventListener('click', () => document.getElementById('import-save-file')?.click());
  document.getElementById('import-save-file')?.addEventListener('change', (event) => {
    importSaveFromJsonFile(event.target.files?.[0]);
    event.target.value = '';
  });
  document.getElementById('rename-save')?.addEventListener('click', renameCurrentSave);
  document.getElementById('clear-save')?.addEventListener('click', clearGameSave);
  root.querySelector('#open-inventory-drawer')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = true;
    render();
  });
  root.querySelector('#close-inventory-drawer')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = false;
    render();
  });
  root.querySelector('#inventory-drawer-backdrop')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = false;
    render();
  });
  root.querySelector('#scene-layer')?.addEventListener('click', () => {
    if (state.viewerImage) {
      state.viewerImage = null;
      render();
    }
  });

  root.querySelector('#reset-preview')?.addEventListener('click', resetPreview);

  root.querySelectorAll('[data-hotspot-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      triggerHotspot(button.dataset.hotspotId);
    });
  });

  root.querySelectorAll('[data-scene-object-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      triggerSceneObject(el.dataset.sceneObjectId);
    });
  });

  root.querySelectorAll('[data-item-id]').forEach((button) => {
    button.setAttribute('draggable', 'true');

    button.addEventListener('click', () => openInventoryItem(button.dataset.itemId));
    button.addEventListener('dragstart', () => {
      state.draggedInventoryId = button.dataset.itemId;
    });
    button.addEventListener('dragend', () => {
      state.draggedInventoryId = null;
    });
    button.addEventListener('dragover', (event) => event.preventDefault());
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      if (state.draggedInventoryId && state.draggedInventoryId !== button.dataset.itemId) {
        combineInventoryItems(state.draggedInventoryId, button.dataset.itemId);
      }
      state.draggedInventoryId = null;
    });
  });

  root.querySelectorAll('#combine-items').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.selectedInventoryIds.length !== 2) {
        state.dialogue = 'Sélectionne 2 objets à combiner.';
        render();
        return;
      }
      combineInventoryItems(state.selectedInventoryIds[0], state.selectedInventoryIds[1]);
    });
  });

  root.querySelector('#close-cinematic')?.addEventListener('click', closeCinematic);
  root.querySelector('#advance-cinematic')?.addEventListener('click', advanceCinematic);
  root.querySelector('#prev-cinematic')?.addEventListener('click', () => {
    state.playingSlideIndex = Math.max(0, state.playingSlideIndex - 1);
    render();
  });

  root.querySelector('#cinematic-overlay')?.addEventListener('click', (event) => {
    if (event.target.id === 'cinematic-overlay') closeCinematic();
  });

  root.querySelector('#cinematic-video')?.addEventListener('ended', closeCinematic);

  root.querySelector('#close-enigma')?.addEventListener('click', () => {
    closeEnigma();
    render();
  });

  root.querySelector('#submit-enigma')?.addEventListener('click', submitEnigma);

  root.querySelector('#enigma-input')?.addEventListener('input', (event) => {
    state.enigmaCodeInput = event.target.value;
  });

  root.querySelector('#enigma-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitEnigma();
  });

  root.querySelectorAll('[data-code-index]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const index = Number(input.dataset.codeIndex);
      const length = Number(input.dataset.codeLength) || 4;
      const chars = Array.from({ length }, (_, charIndex) => state.enigmaCodeInput[charIndex] || '');
      chars[index] = event.target.value.slice(-1).toUpperCase();
      state.enigmaCodeInput = chars.join('').trimEnd();
      render();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submitEnigma();
    });
  });

  root.querySelectorAll('[data-code-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.codeKey;
      const length = Number(button.dataset.codeLength) || 4;
      if (key === '?' || key === '?') {
        state.enigmaCodeInput = state.enigmaCodeInput.slice(0, -1);
      } else {
        state.enigmaCodeInput = (state.enigmaCodeInput + key).slice(0, length);
      }
      render();
    });
  });

  root.querySelector('#clear-code')?.addEventListener('click', () => {
    state.enigmaCodeInput = '';
    render();
  });

  root.querySelectorAll('[data-misc-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      state.enigmaCodeInput = button.dataset.miscChoice || '';
      render();
    });
  });

  root.querySelectorAll('[data-misc-order]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify([...current, button.dataset.miscOrder || '']);
      render();
    });
  });

  root.querySelectorAll('[data-misc-order-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const removeIndex = Number(button.dataset.miscOrderRemove);
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify(current.filter((_, index) => index !== removeIndex));
      render();
    });
  });

  root.querySelectorAll('[data-misc-match-left]').forEach((select) => {
    select.addEventListener('change', () => {
      const current = parseJsonValue(state.enigmaCodeInput, {});
      state.enigmaCodeInput = JSON.stringify({ ...current, [select.dataset.miscMatchLeft]: select.value });
      render();
    });
  });

  root.querySelectorAll('[data-misc-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.miscToggle || '';
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify(current.includes(choice) ?
         current.filter((entry) => entry !== choice)
        : [...current, choice]);
      render();
    });
  });

  root.querySelector('#clear-colors')?.addEventListener('click', () => {
    state.enigmaColorAttempt = [];
    render();
  });

  root.querySelectorAll('[data-enigma-color]').forEach((button) => {
    button.addEventListener('click', () => pushEnigmaColor(button.dataset.enigmaColor));
  });

  root.querySelectorAll('[data-puzzle-index]').forEach((button) => {
    button.addEventListener('click', () => clickPuzzlePiece(Number(button.dataset.puzzleIndex)));
  });

  root.querySelectorAll('[data-rotation-index]').forEach((button) => {
    button.addEventListener('click', () => rotatePuzzlePiece(Number(button.dataset.rotationIndex)));
  });

  root.querySelectorAll('[data-simon-color]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.simonPlayerTurn) return;
      pushEnigmaColor(button.dataset.simonColor);
    });
  });

  root.querySelector('#replay-simon')?.addEventListener('click', () => {
    if (state.activeEnigma?.enigma) startSimonPlayback(state.activeEnigma.enigma);
  });

  root.querySelectorAll('[data-slot-index]').forEach((button) => {
    button.addEventListener('click', () => returnDragPieceToBank(Number(button.dataset.slotIndex)));
    button.addEventListener('dragover', (event) => event.preventDefault());
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      moveDragPieceToSlot(state.enigmaDraggedPiece, Number(button.dataset.slotIndex));
      state.enigmaDraggedPiece = null;
    });
  });

  root.querySelectorAll('[data-bank-piece]').forEach((button) => {
    button.setAttribute('draggable', 'true');
    button.addEventListener('dragstart', () => {
      state.enigmaDraggedPiece = Number(button.dataset.bankPiece);
    });
    button.addEventListener('dragend', () => {
      state.enigmaDraggedPiece = null;
    });
  });
}

function renderCinematic(cinematic, slide) {
  if (!cinematic) return '';
  if ((cinematic.cinematicType || 'slides') === 'video') {
    return '<div class="overlay" id="cinematic-overlay"><div class="overlay-card">'
      + (cinematic.videoData ?
         '<video id="cinematic-video" class="overlay-media" src="' + cinematic.videoData + '" '
          + (cinematic.videoControls === false ? '' : 'controls ') + (cinematic.videoAutoplay === false ? '' : 'autoplay ')
          + '></video>'
        : '<p class="small-note">Ajoute une vidéo dans l’éditeur de cinématique.</p>')
      + '<p class="narration">' + safeHtml(cinematic.name || 'Cinématique') + '</p>'
      + '<div class="panel-head"><span></span><button id="close-cinematic">Terminer</button></div></div></div>';
  }

  if (!slide) return '';

  return '<div class="overlay" id="cinematic-overlay"><div class="overlay-card">'
    + (slide.imageData ? '<img class="overlay-media" src="' + slide.imageData + '" alt="' + safeHtml(slide.imageName || slide.narration || 'Cinématique') + '" />' : '')
    + (slide.audioData ? '<audio id="cinematic-audio" class="overlay-media" controls autoplay src="' + slide.audioData + '"></audio>' : '')
    + '<p class="narration">' + safeHtml(slide.narration || '') + '</p>'
    + '<div class="panel-head">'
    + '<button id="prev-cinematic" class="secondary-button">Précédent</button>'
    + '<button id="advance-cinematic">Suivant</button>'
    + '<button id="close-cinematic" class="secondary-button">Terminer</button>'
    + '</div></div></div>';
}

function renderEnigma(enigma) {
  if (!enigma) return '';

  const rows = Number(enigma.gridRows) || 3;
  const cols = Number(enigma.gridCols) || 3;
  const pieceCount = rows * cols;
  const overlayGradient = POPUP_OVERLAY_GRADIENTS[enigma.popupBackgroundOverlay] || POPUP_OVERLAY_GRADIENTS.dark;
  const overlayStyle = enigma.popupBackgroundData ?
     ' style="background-image:' + overlayGradient + ', url(' + enigma.popupBackgroundData + ');background-size:' + Math.round((Number(enigma.popupBackgroundZoom) || 1) * 100) + '%;background-position:' + (Number(enigma.popupBackgroundX) || 50) + '% ' + (Number(enigma.popupBackgroundY) || 50) + '%;background-repeat:no-repeat"'
    : '';

  let body = '';

  if (enigma.type === 'code') {
    const codeSkin = enigma.codeSkin || 'safe-wheels';
    const codeLength = Math.min(Math.max(4, String(enigma.solutionText || '').length || 4), 8);
    const codeSlots = Array.from({ length: codeLength }, (_, index) => state.enigmaCodeInput[index] || '');
    const slotInputStyle = 'width:54px;height:64px;text-align:center;font-size:24px;font-weight:900;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(12,21,39,.9);color:white;outline:none';
    const boxInputStyle = 'width:50px;height:50px;text-align:center;font-size:22px;font-weight:900;border-radius:8px;border:2px solid rgba(96,165,250,.75);background:rgba(12,21,39,.9);color:white;outline:none';
    const primaryButtonStyle = 'color:#fff;background:linear-gradient(180deg,#4f8cff 0%,#2f6fe4 100%);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 24px rgba(47,111,228,.24)';
    const keypadKeys = CODE_KEYPAD_KEYS;

    if (codeSkin === 'safe-wheels') {
      body = '<div><label>Roulettes du coffre</label><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">'
        + codeSlots.map((char, index) => '<input data-code-index="' + index + '" data-code-length="' + codeLength + '" maxlength="1" value="' + safeHtml(char) + '" style="' + slotInputStyle + ';background:linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.04))" />').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (codeSkin === 'digicode') {
      body = '<div><label>Digicode</label><div style="display:flex;gap:8px;justify-content:center;margin:10px 0 14px">'
        + codeSlots.map((char) => '<span style="width:42px;height:46px;border-radius:10px;border:1px solid rgba(255,255,255,.22);display:grid;place-items:center;font-size:22px;font-weight:900;background:rgba(15,23,42,.68)">' + safeHtml(char || '?') + '</span>').join('')
        + '</div><div style="display:grid;grid-template-columns:repeat(3,64px);gap:10px;justify-content:center">'
        + keypadKeys.map((key) => '<button type="button" data-code-key="' + key + '" data-code-length="' + codeLength + '" style="height:52px;font-size:20px;font-weight:900;color:#f8fbff;background:linear-gradient(180deg, rgba(59,130,246,.32), rgba(30,41,59,.96));border:1px solid rgba(147,197,253,.34);box-shadow:0 10px 22px rgba(15,23,42,.28)">' + key + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="clear-code" style="color:#dbeafe;background:rgba(15,23,42,.92);border:1px solid rgba(147,197,253,.28)">Effacer</button><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (codeSkin === 'boxes') {
      body = '<div><label>Cases du code</label><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">'
        + codeSlots.map((char, index) => '<input data-code-index="' + index + '" data-code-length="' + codeLength + '" maxlength="1" value="' + safeHtml(char) + '" style="' + boxInputStyle + '" />').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (codeSkin === 'paper-strip') {
      body = '<div><label>Bande papier</label><input id="enigma-input" value="' + safeHtml(state.enigmaCodeInput) + '" '
        + 'style="width:100%;padding:12px 14px;border-radius:8px;border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.92);color:#0f172a;outline:none;text-align:center;font-family:monospace;font-size:24px;font-weight:900;letter-spacing:8px;text-transform:uppercase" />'
        + '<div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else {
      body = '<div><label>Code</label><input id="enigma-input" value="' + safeHtml(state.enigmaCodeInput) + '" '
        + 'style="width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(12,21,39,.9);color:white;outline:none" />'
        + '<div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    }
  }

  if (enigma.type === 'colors') {
    body = '<div><label>Suite en cours</label><div class="color-attempt-row">'
      + (state.enigmaColorAttempt.length ?
         state.enigmaColorAttempt.map((color, index) => '<span class="color-chip" style="background:' + color + '"></span>').join('')
        : '<span class="small-note">Aucune couleur choisie.</span>')
      + '</div><div class="color-picker-grid">'
      + PREVIEW_COLOR_OPTIONS.map(([value, label]) => '<button type="button" class="color-picker-button" data-enigma-color="' + value + '" title="' + label + '" style="background:' + value + '"></button>').join('')
      + '</div><div class="panel-head"><button id="clear-colors" class="secondary-button">Effacer la suite</button><button id="submit-enigma">Valider l’énigme</button></div></div>';
  }

  if (enigma.type === 'misc') {
    const miscMode = enigma.miscMode || 'free-answer';
    const primaryButtonStyle = 'color:#fff;background:linear-gradient(180deg,#4f8cff 0%,#2f6fe4 100%);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 24px rgba(47,111,228,.24)';
    const secondaryButtonStyle = 'color:#dbeafe;background:rgba(15,23,42,.92);border:1px solid rgba(147,197,253,.28)';
    if (miscMode === 'multiple-choice') {
      body = '<div><label>Choisis une réponse</label><div style="display:grid;gap:10px;margin-top:10px">'
        + (enigma.miscChoices || []).map((choice) => '<button type="button" data-misc-choice="' + safeHtml(choice) + '" style="' + (state.enigmaCodeInput === choice ? primaryButtonStyle : secondaryButtonStyle) + '">' + safeHtml(choice) + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'true-false') {
      body = '<div><label>Choisis une réponse</label><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">'
        + ['vrai', 'faux'].map((choice) => '<button type="button" data-misc-choice="' + choice + '" style="' + (state.enigmaCodeInput === choice ? primaryButtonStyle : secondaryButtonStyle) + '">' + (choice === 'vrai' 'Vrai' : 'Faux') + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'ordering') {
      const current = parseJsonValue(state.enigmaCodeInput, []);
      body = '<div><label>Remets dans l’ordre</label><div style="display:grid;gap:10px;margin-top:10px">'
        + '<div class="color-attempt-row">'
        + (current.length ? current.map((choice, index) => '<button type="button" data-misc-order-remove="' + index + '" style="' + secondaryButtonStyle + '">' + (index + 1) + '. ' + safeHtml(choice) + '</button>').join('') : '<span class="small-note">Clique les éléments dans le bon ordre.</span>')
        + '</div>'
        + (enigma.miscChoices || []).filter((choice) => !current.includes(choice)).map((choice) => '<button type="button" data-misc-order="' + safeHtml(choice) + '" style="' + secondaryButtonStyle + '">' + safeHtml(choice) + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'matching') {
      const answers = parseJsonValue(state.enigmaCodeInput, {});
      body = '<div><label>Associe les paires</label><div style="display:grid;gap:10px;margin-top:10px">'
        + (enigma.miscPairs || []).map((pair) => '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center"><strong>' + safeHtml(pair.left || '') + '</strong><select data-misc-match-left="' + safeHtml(pair.left || '') + '"><option value="">Choisir</option>'
          + (enigma.miscPairs || []).map((entry) => '<option value="' + safeHtml(entry.right || '') + '"' + (answers[pair.left] === entry.right ? ' selected' : '') + '>' + safeHtml(entry.right || '') + '</option>').join('')
          + '</select></div>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'numeric-range' || miscMode === 'exact-number') {
      body = '<div><label>' + (miscMode === 'exact-number' 'Nombre exact' : 'Nombre') + '</label><input id="enigma-input" type="number" value="' + safeHtml(state.enigmaCodeInput) + '" '
        + 'style="width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(12,21,39,.9);color:white;outline:none" />'
        + '<p class="small-note">' + (miscMode === 'exact-number' 'La réponse doit correspondre au nombre attendu.' : 'La réponse doit être comprise entre ' + safeHtml(enigma.miscMin ?? '') + ' et ' + safeHtml(enigma.miscMax ?? '') + '.') + '</p>'
        + '<div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'item-select') {
      body = '<div><label>Choisis l’objet</label><div style="display:grid;gap:10px;margin-top:10px">'
        + (project.items || []).map((item) => '<button type="button" data-misc-choice="' + safeHtml(item.id) + '" style="' + (state.enigmaCodeInput === item.id ? primaryButtonStyle : secondaryButtonStyle) + '">' + safeHtml(item.name || 'Objet') + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else if (miscMode === 'multi-select') {
      const current = parseJsonValue(state.enigmaCodeInput, []);
      body = '<div><label>Sélectionne toutes les bonnes réponses</label><div style="display:grid;gap:10px;margin-top:10px">'
        + (enigma.miscChoices || []).map((choice) => '<button type="button" data-misc-toggle="' + safeHtml(choice) + '" style="' + (current.includes(choice) ? primaryButtonStyle : secondaryButtonStyle) + '">' + safeHtml(choice) + '</button>').join('')
        + '</div><div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    } else {
      body = '<div><label>' + (miscMode === 'fill-blank' 'Mot manquant' : 'Réponse') + '</label><input id="enigma-input" value="' + safeHtml(state.enigmaCodeInput) + '" placeholder="Écris ta réponse..." '
        + 'style="width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(12,21,39,.9);color:white;outline:none" />'
        + '<p class="small-note">La réponse est acceptée même avec des majuscules différentes ou des mots en plus.</p>'
        + '<div class="inventory-actions"><button id="submit-enigma" style="' + primaryButtonStyle + '">Valider l’énigme</button></div></div>';
    }
  }

  if (enigma.type === 'simon') {
    body = '<div><p class="small-note">' + (state.simonPlayerTurn 'À toi de rejouer la séquence.' : 'Observe la séquence?') + '</p>'
      + '<div class="color-picker-grid simon-grid">'
      + PREVIEW_COLOR_OPTIONS.slice(0, 4).map(([value, label], index) => {
        const solutionColor = (enigma.solutionColors || [])[state.simonPlaybackIndex];
        const lit = solutionColor === value ? ' active' : '';
        return '<button type="button" class="color-picker-button simon-pad' + lit + '" data-simon-color="' + value + '" title="' + label + '" style="background:' + value + '"' + (state.simonPlayerTurn ? '' : ' disabled') + '>' + (index + 1) + '</button>';
      }).join('')
      + '</div><div class="color-attempt-row" style="margin-top:14px">'
      + state.enigmaColorAttempt.map((color) => '<span class="color-chip" style="background:' + color + '"></span>').join('')
      + '</div><div class="inventory-actions"><button id="replay-simon" class="secondary-button">Rejouer la séquence</button></div></div>';
  }

  if (enigma.type === 'puzzle' && enigma.imageData) {
    body = '<div><p class="small-note">Clique une pièce, puis une deuxième pour les échanger.</p>'
      + '<div class="enigma-grid" style="grid-template-columns:repeat(' + cols + ', 1fr)">'
      + state.enigmaPuzzleOrder.map((pieceIndex, index) => '<button type="button" data-puzzle-index="' + index + '" class="puzzle-piece'
        + (state.enigmaPuzzleSelectedIndex === index ? ' selected' : '') + '" style="' + makePieceStyle(enigma.imageData, rows, cols, pieceIndex) + '"></button>').join('')
      + '</div></div>';
  }

  if (enigma.type === 'rotation' && enigma.imageData) {
    body = '<div><p class="small-note">Clique sur chaque pièce pour la remettre à l’endroit.</p>'
      + '<div class="enigma-grid" style="grid-template-columns:repeat(' + cols + ', 1fr)">'
      + Array.from({ length: pieceCount }, (_, index) => '<button type="button" data-rotation-index="' + index + '" class="puzzle-piece" style="'
        + makePieceStyle(enigma.imageData, rows, cols, index, state.enigmaRotationAngles[index] || 0) + '"></button>').join('')
      + '</div></div>';
  }

  if (enigma.type === 'dragdrop' && enigma.imageData) {
    body = '<div><p class="small-note">Glisse les pièces vers la bonne case. Clique une case remplie pour renvoyer sa pièce dans la réserve.</p>'
      + '<div class="dragdrop-layout"><div><h3>Plateau</h3><div class="enigma-grid" style="grid-template-columns:repeat(' + cols + ', 1fr)">'
      + state.enigmaDragSlots.map((pieceIndex, slotIndex) => '<button type="button" data-slot-index="' + slotIndex + '" class="puzzle-slot">'
        + (pieceIndex !== null && pieceIndex !== undefined ?
           '<span class="puzzle-piece static" style="' + makePieceStyle(enigma.imageData, rows, cols, pieceIndex) + '"></span>'
          : '<span class="slot-index">' + (slotIndex + 1) + '</span>') + '</button>').join('')
      + '</div></div><div><h3>Pièces</h3><div class="bank-grid">'
      + state.enigmaDragBank.map((pieceIndex) => '<button type="button" data-bank-piece="' + pieceIndex + '" class="puzzle-piece" draggable="true" style="'
        + makePieceStyle(enigma.imageData, rows, cols, pieceIndex) + '"></button>').join('')
      + '</div></div></div></div>';
  }

  if (usesImage(enigma.type) && !enigma.imageData) {
    body = '<p class="small-note">Ajoute une image dans l’éditeur d’énigmes pour jouer cette énigme.</p>';
  }

  return '<div class="overlay" id="enigma-overlay"><div class="overlay-card"' + overlayStyle + '><div class="panel-head"><div><h2 style="margin:0">'
    + safeHtml(enigma.name || 'énigme') + '</h2><p class="small-note" style="margin:6px 0 0">'
    + safeHtml(enigma.question || '') + '</p></div><button id="close-enigma" class="danger-button">Fermer</button></div>'
    + body + '</div></div>';
}

function render(shouldSave = true) {
  const playScene = getPlayScene();
  const cinematic = getCurrentCinematic();
  const currentSlide = getCurrentSlide();
  const enigma = state.activeEnigma?.enigma || null;
  const sceneAspectRatio = Number(playScene?.backgroundAspectRatio) > 0 ? Number(playScene.backgroundAspectRatio) : 1.6;

  root.innerHTML = '<div class="layout">'
    + '<section class="panel main">'
    + '<div class="scene-player" id="scene-layer" style="--scene-aspect:' + sceneAspectRatio + '">'
    + (playScene?.backgroundData ?
       '<img class="bg" src="' + playScene.backgroundData + '" alt="' + safeHtml(playScene.name || 'Scène') + '" onload="setSceneAspectFromImage(this)" />'
      : '<div class="placeholder">Ajoute un fond pour jouer la scène.</div>')
    + (playScene?.visualEffect && playScene.visualEffect !== 'none' ? '<div class="scene-visual-effect scene-visual-effect--' + safeHtml(playScene.visualEffect) + ' scene-visual-effect--' + safeHtml(playScene.visualEffectIntensity || 'normal') + '"></div>' : '')
    + (playScene?.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => '<div class="scene-visual-effect scene-visual-effect-zone scene-visual-effect--' + safeHtml(zone.effect || 'sparkles') + ' scene-visual-effect--' + safeHtml(zone.intensity || 'normal') + '" style="left:' + zone.x + '%;top:' + zone.y + '%;width:' + zone.width + '%;height:' + zone.height + '%;z-index:' + getVisualEffectZoneZIndex(zone.layer) + '"></div>').join('')
    + (playScene?.hotspots || []).map((spot) => '<button type="button" class="player-hotspot" data-hotspot-id="' + spot.id + '" '
      + 'style="left:' + spot.x + '%;top:' + spot.y + '%;width:' + spot.width + '%;height:' + spot.height + '%;z-index:20;cursor:pointer;" title="' + safeHtml(spot.name || '') + '"></button>').join('')
    + (playScene?.sceneObjects || []).filter((obj) => !state.removedSceneObjectIds.includes(obj.id)).map((obj) => '<button type="button" class="player-scene-object" data-scene-object-id="' + obj.id + '" '
      + 'style="left:' + obj.x + '%;top:' + obj.y + '%;width:' + obj.width + '%;height:' + obj.height + '%;z-index:18;" title="' + safeHtml(obj.name || 'Objet') + '">'
      + (obj.imageData ? '<img src="' + obj.imageData + '" alt="' + safeHtml(obj.name || 'Objet') + '" />' : '<span>' + safeHtml(obj.name || 'Objet') + '</span>')
      + '</button>').join('')
    + (playScene?.timerEnabled ? '<div class="scene-timer-hud"><strong id="scene-timer-count">' + formatSceneTimerSeconds(state.sceneTimerRemaining || playScene.timerSeconds || 0) + '</strong>'
      + (playScene.timerEndAction === 'damage-life' ? '<span>Vies: ' + safeHtml(state.playerLives ?? 3) + '</span>' : '')
      + '</div>' : '')
    + (state.viewerImage ? '<div class="scene-inline-viewer"><div class="scene-inline-viewer__backdrop"></div><div class="scene-inline-viewer__card">'
      + '<img class="scene-inline-viewer__image" src="' + state.viewerImage.src + '" alt="' + safeHtml(state.viewerImage.name || 'Objet') + '" />'
      + '<div class="scene-inline-viewer__name">' + safeHtml(state.viewerImage.name || 'Objet') + '</div></div></div>' : '')
    + (state.sceneTransitionOverlay ? '<div class="scene-transition-overlay scene-transition-overlay--' + safeHtml(state.sceneTransitionOverlay.type || 'fade') + '" style="--scene-transition-duration:' + (Number(state.sceneTransitionOverlay.duration) || 700) + 'ms">'
      + (state.sceneTransitionOverlay.scene?.backgroundData ?
        '<img src="' + state.sceneTransitionOverlay.scene.backgroundData + '" alt="" />'
        : '<div class="placeholder">Scene precedente</div>')
      + '</div>' : '')
    + '</div><div class="inventory-actions"><button id="reset-preview">Recommencer</button></div></section>'

    + '<section class="panel side">'
    + '<div class="badge-line">' + safeHtml(playScene ? getSceneLabel(playScene.id) : 'Aucune scène') + '</div>'
    + '<div class="dialogue-box"><p>' + safeHtml(state.dialogue || 'Aucun message.') + '</p></div>'
    + '<div class="panel-head"><h3>Inventaire</h3><button id="combine-items">Combiner les 2 objets</button></div>'
    + '<div class="inventory-grid">'
    + (state.inventory.length ? state.inventory.map((itemId) => {
      const item = getItemById(itemId);
      if (!item) return '';
      return '<button type="button" class="inventory-tile'
        + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + itemId + '">'
        + '<div class="inventory-thumb">'
        + (item.imageData ? '<img src="' + item.imageData + '" alt="' + safeHtml(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
        + '</div><strong>' + safeHtml(item.name || '') + '</strong></button>';
    }).join('') : '<p>Aucun objet dans l’inventaire.</p>')
    + '</div><p class="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p></section>'
    + '</div>'
    + '<div class="fullscreen-hud">'
    + '<div class="fullscreen-dialogue">' + safeHtml(state.dialogue || 'Aucun message.') + '</div>'
    + '<div class="fullscreen-actions"><button id="save-game" class="hud-button" type="button">Sauvegarder</button><button id="load-game" class="hud-button" type="button">Charger</button><button id="export-save-json" class="hud-button" type="button">Exporter JSON</button><button id="import-save-json" class="hud-button" type="button">Importer JSON</button><button id="open-inventory-drawer" class="hud-button" type="button">Inventaire</button></div>'
    + '</div>'
    + (state.inventoryDrawerOpen  '<div id="inventory-drawer-backdrop" class="inventory-drawer__backdrop"></div><aside class="inventory-drawer open"><div class="inventory-drawer__head"><h3>Inventaire</h3><button id="close-inventory-drawer" class="secondary-button" type="button">Fermer</button></div><div class="inventory-actions"><button id="combine-items" type="button">Combiner les 2 objets</button></div><div class="inventory-grid">'
    + (state.inventory.length ? state.inventory.map((itemId) => {
      const item = getItemById(itemId);
      if (!item) return '';
      return '<button type="button" class="inventory-tile'
        + (state.selectedInventoryIds.includes(itemId) ? ' selected' : '') + '" data-item-id="' + itemId + '">'
        + '<div class="inventory-thumb">'
        + (item.imageData ? '<img src="' + item.imageData + '" alt="' + safeHtml(item.name || '') + '" />' : '<span>' + safeHtml(item.icon || '📦') + '</span>')
        + '</div><strong>' + safeHtml(item.name || '') + '</strong></button>';
    }).join('') : '<p>Aucun objet dans l’inventaire.</p>')
    + '</div><p class="small-note">Cliquer = voir l’image. Glisser-déposer un objet sur un autre = tenter une combinaison.</p></aside>' : '')
    + renderCinematic(cinematic, currentSlide)
    + renderEnigma(enigma);

  bindEvents();
  syncFullscreenUi();
  playSceneMusic();
  scheduleSceneTimer();
  if (sceneTransitionTimer) {
    clearTimeout(sceneTransitionTimer);
    sceneTransitionTimer = null;
  }
  if (state.sceneTransitionOverlay) {
    sceneTransitionTimer = setTimeout(() => {
      state.sceneTransitionOverlay = null;
      sceneTransitionTimer = null;
      render(false);
    }, (Number(state.sceneTransitionOverlay.duration) || 700) + 80);
  }

  if (shouldSave && hasRenderedOnce) saveGame(false);
  hasRenderedOnce = true;

  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }
  const audioNode = root.querySelector('#cinematic-audio');
  if (audioNode) {
    cinematicAudio = audioNode;
  }

  if (shouldAutosave) {
    saveGame(false);
  }
}

if (!loadGame(false)) {
  render(false);
}
</script>
</body>
</html>`;
}
