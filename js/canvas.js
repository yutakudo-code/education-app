// ============================================================
// js/canvas.js - 手書きキャンバス（Apple Pencil & タッチ対応）
// ============================================================

class HandwritingCanvas {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.penSize = options.penSize || 12;
    this.penColor = options.penColor || '#1a1a2e';
    this.bgColor = options.bgColor || '#fffef7';
    this.onStrokeStart = options.onStrokeStart || null;
    this.onStrokeEnd = options.onStrokeEnd || null;
    this.paths = [];
    this.currentPath = [];
    this.isDrawing = false;
    this.activePointerId = null;
    this.lastX = 0;
    this.lastY = 0;
    this.undoStack = [];

    this._init();
  }

  _init() {
    this._resize();
    this._clear(true);
    this._bindEvents();
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height || 300) * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = (rect.height || 300) + 'px';
    this.ctx.scale(dpr, dpr);
    this._redraw();
  }

  _bindEvents() {
    const c = this.canvas;
    
    // touch-action: none はスクロール・ズームを防ぐ（CSS側でも設定済みだが念のため）
    c.style.touchAction = 'none';
    // iOSの長押しメニュー等を無効化
    c.style.webkitTouchCallout = 'none';
    c.style.webkitUserSelect = 'none';

    // { passive: false } で preventDefault() を有効にする
    c.addEventListener('pointerdown', e => this._onDown(e), { passive: false });
    c.addEventListener('pointermove', e => this._onMove(e), { passive: false });
    c.addEventListener('pointerup', e => this._onUp(e));
    c.addEventListener('pointercancel', e => this._onCancel(e));
    // pointerleave は使わない（setPointerCaptureと競合し、ストロークが途切れる原因になる）
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  _getPressure(e) {
    if (e.pointerType === 'pen') {
      return e.pressure || 0.5;
    }
    return 0.5;
  }

  _onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    // ★重要: ブラウザのジェスチャー認識（スクロール・ズーム）を完全にブロック
    // これがないとiPadSafariがペンのpointerをcancelしてしまう
    e.preventDefault();
    e.stopPropagation();
    
    // === pointerId ベースの排他制御 ===
    // すでに描画中のポインターがある場合
    if (this.activePointerId !== null && this.activePointerId !== undefined) {
      if (e.pointerType === 'pen' && this.activePointerType !== 'pen') {
        // ペンが来たら手を中断してペンに切り替える（ペン優先）
        this._saveCurrentStroke();
      } else {
        // それ以外（手が2本目、ペン中に手が触れた等）は完全無視
        return;
      }
    }
    
    // この pointerId を描画対象として登録
    this.activePointerId = e.pointerId;
    this.activePointerType = e.pointerType;
    this.isDrawing = true;

    // PointerCapture: このポインターのイベントを確実にこのCanvasで受け取る
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}

    const pos = this._getPos(e);
    this.lastPressure = this._getPressure(e);
    if (this.lastPressure === 0 && e.pointerType === 'pen') this.lastPressure = 0.1;
    this.currentPath = [{ x: pos.x, y: pos.y, p: this.lastPressure }];
    
    if (this.onStrokeStart) this.onStrokeStart();
  }

  // 新しいポイントからの描画セグメントを一括描画（高速化）
  _drawSegments(startIdx) {
    const pts = this.currentPath;
    if (pts.length < 2 || startIdx >= pts.length) return;
    
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = this.penSize * 1.2;

    // 全ての新しいセグメントを1つのパスにまとめて一括描画（高速）
    this.ctx.beginPath();
    this.ctx.moveTo(pts[Math.max(0, startIdx - 1)].x, pts[Math.max(0, startIdx - 1)].y);
    for (let i = startIdx; i < pts.length; i++) {
      this.ctx.lineTo(pts[i].x, pts[i].y);
    }
    this.ctx.stroke();
  }

  _onMove(e) {
    if (!this.isDrawing) return;
    if (e.pointerId !== this.activePointerId) return;
    
    e.preventDefault();
    e.stopPropagation();

    const prevLen = this.currentPath.length;

    // 全ポイントを一気に収集（描画はまとめて後で行う）
    const collectPoint = (ev) => {
      const pos = this._getPos(ev);
      this.currentPath.push({ x: pos.x, y: pos.y, p: this._getPressure(ev) });
    };

    if (e.getCoalescedEvents) {
      const events = e.getCoalescedEvents();
      if (events.length > 0) {
        for (let i = 0; i < events.length; i++) collectPoint(events[i]);
      } else {
        collectPoint(e);
      }
    } else {
      collectPoint(e);
    }

    // 収集した全ポイントを1回のcanvas描画でまとめて描く
    this._drawSegments(prevLen);
  }

  _onUp(e) {
    if (!this.isDrawing) return;
    // 違うポインター（手など）が離れたイベントは無視
    if (e.pointerId !== this.activePointerId) return;
    
    this.isDrawing = false;
    this.activePointerId = null;
    
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) {}

    const pos = this._getPos(e);
    let p = this._getPressure(e);
    const prevLen = this.currentPath.length;
    this.currentPath.push({ x: pos.x, y: pos.y, p: p });
    this._drawSegments(prevLen);

    this._saveCurrentStroke();
    
    if (this.onStrokeEnd) this.onStrokeEnd();
  }

  // pointercancel: ブラウザがポインターを強制中断した場合（ジェスチャー認識等）
  // ストロークを失わないように、途中までの描画を保存する
  _onCancel(e) {
    if (!this.isDrawing) return;
    if (e.pointerId !== this.activePointerId) return;
    
    this.isDrawing = false;
    this.activePointerId = null;

    // 途中までのストロークを保存（描画データを失わない）
    this._saveCurrentStroke();
    
    if (this.onStrokeEnd) this.onStrokeEnd();
  }

  _saveCurrentStroke() {
    if (this.currentPath.length > 0) {
      this.paths.push({ points: [...this.currentPath], penSize: this.penSize, color: this.penColor });
      this.undoStack.push('path');
    }
    this.currentPath = [];
  }

  _clear(silent = false) {
    this.ctx.fillStyle = this.bgColor;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this._drawGuideLines();
  }

  _drawGuideLines() {
    const w = this.canvas.getBoundingClientRect().width;
    const h = this.canvas.getBoundingClientRect().height;
    this.ctx.strokeStyle = '#e0dff5';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 8]);
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2, 0); this.ctx.lineTo(w / 2, h);
    this.ctx.moveTo(0, h / 2); this.ctx.lineTo(w, h / 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  _drawSmoothPath(path) {
    const pts = path.points;
    if (pts.length === 0) return;
    
    this.ctx.strokeStyle = path.color;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (pts.length === 1) {
      this.ctx.beginPath();
      this.ctx.arc(pts[0].x, pts[0].y, (path.penSize * pts[0].p * 1.5) / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = path.color;
      this.ctx.fill();
      return;
    }
    
    if (pts.length === 2) {
      this.ctx.beginPath();
      this.ctx.moveTo(pts[0].x, pts[0].y);
      this.ctx.lineTo(pts[1].x, pts[1].y);
      this.ctx.lineWidth = path.penSize * pts[1].p * 1.5;
      this.ctx.stroke();
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(pts[0].x, pts[0].y);
    const mid0 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    this.ctx.lineTo(mid0.x, mid0.y);
    this.ctx.lineWidth = path.penSize * pts[0].p * 1.5;
    this.ctx.stroke();

    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      
      const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      
      this.ctx.beginPath();
      this.ctx.moveTo(mid1.x, mid1.y);
      this.ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
      this.ctx.lineWidth = path.penSize * p1.p * 1.5;
      this.ctx.stroke();
    }

    const lastIdx = pts.length - 1;
    const midLast = { x: (pts[lastIdx-1].x + pts[lastIdx].x) / 2, y: (pts[lastIdx-1].y + pts[lastIdx].y) / 2 };
    this.ctx.beginPath();
    this.ctx.moveTo(midLast.x, midLast.y);
    this.ctx.lineTo(pts[lastIdx].x, pts[lastIdx].y);
    this.ctx.lineWidth = path.penSize * pts[lastIdx].p * 1.5;
    this.ctx.stroke();
  }

  _redraw() {
    this._clear(true);
    this.paths.forEach(path => {
      this._drawSmoothPath(path);
    });
  }

  // 公開メソッド
  clear() {
    this.paths = [];
    this.undoStack = [];
    this._clear();
  }

  undo() {
    if (this.paths.length > 0) {
      this.paths.pop();
      this._redraw();
    }
  }

  setPenSize(size) { this.penSize = parseInt(size); }

  isEmpty() {
    return this.paths.length === 0;
  }

  // Canvas → Base64 PNG（OCR用・白背景、ガイドライン除去、高コントラスト化）
  toBase64() {
    // 全ストロークからバウンディングボックスを計算
    const allPaths = [...this.paths];
    if (this.currentPath.length > 0) {
      allPaths.push({ points: [...this.currentPath], penSize: this.penSize });
    }
    if (allPaths.length === 0) return '';

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const path of allPaths) {
      for (const pt of path.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }

    // コンテンツのサイズ（最小80pxを確保: 「二」のような薄い文字が潰れないようにする）
    const contentW = Math.max(maxX - minX, 80) || 80;
    const contentH = Math.max(maxY - minY, 80) || 80;

    // 固定サイズのOCR用キャンバス（400x400px、余白15%）
    const OCR_SIZE = 400;
    const PADDING = 0.15;
    const drawArea = OCR_SIZE * (1 - PADDING * 2);
    const scaleFactor = Math.min(drawArea / contentW, drawArea / contentH);
    // バウンディングボックスの中心を使う（最小サイズ保証のためオリジナルの値で計算）
    const origW = maxX - minX || 1;
    const origH = maxY - minY || 1;
    const offsetX = (OCR_SIZE - origW * scaleFactor) / 2;
    const offsetY = (OCR_SIZE - origH * scaleFactor) / 2;

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = OCR_SIZE;
    tmpCanvas.height = OCR_SIZE;
    const tmpCtx = tmpCanvas.getContext('2d');

    // 完全な白背景
    tmpCtx.fillStyle = '#ffffff';
    tmpCtx.fillRect(0, 0, OCR_SIZE, OCR_SIZE);

    // 固定の線の太さ（5px - 細すぎると「二」の2本線がかすれて認識されない）
    const LINE_WIDTH = 5;
    tmpCtx.strokeStyle = '#000000';
    tmpCtx.fillStyle = '#000000';
    tmpCtx.lineCap = 'round';
    tmpCtx.lineJoin = 'round';
    tmpCtx.lineWidth = LINE_WIDTH;

    for (const path of allPaths) {
      const pts = path.points;
      if (pts.length === 0) continue;

      // 座標を正規化してOCRキャンバスに描画
      const tx = (pt) => (pt.x - minX) * scaleFactor + offsetX;
      const ty = (pt) => (pt.y - minY) * scaleFactor + offsetY;

      if (pts.length === 1) {
        tmpCtx.beginPath();
        tmpCtx.arc(tx(pts[0]), ty(pts[0]), LINE_WIDTH / 2, 0, Math.PI * 2);
        tmpCtx.fill();
        continue;
      }

      tmpCtx.beginPath();
      tmpCtx.moveTo(tx(pts[0]), ty(pts[0]));
      for (let i = 1; i < pts.length; i++) {
        tmpCtx.lineTo(tx(pts[i]), ty(pts[i]));
      }
      tmpCtx.stroke();
    }

    const dataURL = tmpCanvas.toDataURL('image/png');
    return dataURL.split(',')[1];
  }

  resize() { this._resize(); }
}
