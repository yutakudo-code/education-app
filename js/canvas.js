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
    this.paths = [];
    this.currentPath = [];
    this.isDrawing = false;
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
    // Pointer Events（マウス・タッチ・Apple Pencil）
    c.addEventListener('pointerdown', e => this._onDown(e));
    c.addEventListener('pointermove', e => this._onMove(e));
    c.addEventListener('pointerup', e => this._onUp(e));
    c.addEventListener('pointercancel', e => this._onUp(e));
    c.addEventListener('pointerleave', e => this._onUp(e));
    c.style.touchAction = 'none'; // スクロール防止
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
      return e.pressure; // Apple Pencilの場合は0〜1の実際の筆圧を返す（離すときは0に近づく）
    }
    return 0.5; // タッチやマウスの場合は一定
  }

  _onDown(e) {
    e.preventDefault();
    if (e.pointerType === 'pen') this.penInUse = true;
    // ペン使用中はタッチ（手のひら）を無視する簡易パームリジェクション
    if (this.penInUse && e.pointerType === 'touch') return;

    this.isDrawing = true;
    const pos = this._getPos(e);
    this.lastPressure = this._getPressure(e);
    if (this.lastPressure === 0 && e.pointerType === 'pen') this.lastPressure = 0.1;
    this.currentPath = [{ x: pos.x, y: pos.y, p: this.lastPressure }];
    
    // 最初から丸を描かず、動いたときに描画する（線の両側に不自然な丸がつくのを防ぐ）
  }

  _drawLiveSegment() {
    const pts = this.currentPath;
    const len = pts.length;
    
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (len === 1 && !this.isDrawing) {
      // 点を打つ（タップ）だけの場合
      this.ctx.beginPath();
      this.ctx.arc(pts[0].x, pts[0].y, (this.penSize * pts[0].p * 1.5) / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = this.penColor;
      this.ctx.fill();
      return;
    }

    if (len === 2) {
      const p0 = pts[0];
      const p1 = pts[1];
      const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      this.ctx.beginPath();
      this.ctx.moveTo(p0.x, p0.y);
      this.ctx.lineTo(mid.x, mid.y);
      this.ctx.lineWidth = this.penSize * p0.p * 1.5;
      this.ctx.stroke();
      return;
    }
    
    if (len >= 3) {
      const p0 = pts[len - 3];
      const p1 = pts[len - 2];
      const p2 = pts[len - 1];
      
      const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      
      this.ctx.beginPath();
      this.ctx.moveTo(mid1.x, mid1.y);
      this.ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
      // 筆圧に忠実に太さを変える（離すときは細くフェードアウトする）
      this.ctx.lineWidth = this.penSize * p1.p * 1.5;
      this.ctx.stroke();
    }
  }

  _onMove(e) {
    if (!this.isDrawing) return;
    if (this.penInUse && e.pointerType === 'touch') return;
    e.preventDefault();

    const addPoint = (ev) => {
      const pos = this._getPos(ev);
      let p = this._getPressure(ev);
      this.lastPressure = this.lastPressure * 0.7 + p * 0.3; // スムージング

      const last = this.currentPath[this.currentPath.length - 1];
      if (last) {
        const dx = pos.x - last.x;
        const dy = pos.y - last.y;
        if (dx * dx + dy * dy < 2) return; // 近すぎる点をスキップ
      }
      this.currentPath.push({ x: pos.x, y: pos.y, p: this.lastPressure });
      this._drawLiveSegment();
    };

    if (e.getCoalescedEvents) {
      const events = e.getCoalescedEvents();
      events.forEach(ev => addPoint(ev));
    } else {
      addPoint(e);
    }
  }

  _onUp(e) {
    if (!this.isDrawing) return;
    if (this.penInUse && e.pointerType === 'touch') return;
    this.isDrawing = false;
    
    const pos = this._getPos(e);
    let p = this._getPressure(e);
    this.currentPath.push({ x: pos.x, y: pos.y, p: p });
    this._drawLiveSegment();

    // 最後のセグメントの描画
    const pts = this.currentPath;
    const len = pts.length;
    if (len >= 2) {
      const p1 = pts[len - 2];
      const p2 = pts[len - 1];
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      this.ctx.beginPath();
      this.ctx.moveTo(mid.x, mid.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.lineWidth = this.penSize * p2.p * 1.5;
      this.ctx.stroke();
    }

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

  // Canvas → Base64 PNG（OCR用・白背景）
  toBase64() {
    // オフスクリーンキャンバスに白背景で書き出し
    const tmpCanvas = document.createElement('canvas');
    const rect = this.canvas.getBoundingClientRect();
    // OCR用に適切なサイズにスケール
    const W = 400, H = 400;
    tmpCanvas.width = W; tmpCanvas.height = H;
    const tmpCtx = tmpCanvas.getContext('2d');

    // 白背景
    tmpCtx.fillStyle = '#ffffff';
    tmpCtx.fillRect(0, 0, W, H);

    // メインキャンバスの内容を描画
    tmpCtx.drawImage(this.canvas, 0, 0, W, H);

    const dataURL = tmpCanvas.toDataURL('image/png');
    return dataURL.split(',')[1]; // base64部分だけ返す
  }

  resize() { this._resize(); }
}
