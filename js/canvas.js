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
    const opts = { passive: false };
    
    // Pointer Events（マウス・タッチ・Apple Pencil）
    // iOSでは touch-action: none がスクロール防止の標準。touchstartのpreventDefaultはPointer Eventを壊す原因になるため削除
    c.style.touchAction = 'none';

    c.addEventListener('pointerdown', e => this._onDown(e), opts);
    c.addEventListener('pointermove', e => this._onMove(e), opts);
    c.addEventListener('pointerup', e => this._onUp(e), opts);
    c.addEventListener('pointercancel', e => this._onUp(e), opts);
    c.addEventListener('pointerleave', e => this._onUp(e), opts);
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
    
    if (this.isDrawing) {
      if (this.activePointerType === 'pen' && e.pointerType !== 'pen') {
        // すでにペンで描画中の場合、手などが触れても無視する（完璧なパームリジェクション）
        return;
      }
      if (this.activePointerType === 'touch' && e.pointerType === 'touch') {
        // すでに手で描画中で、さらに別の指が触れた場合は無視する
        return;
      }
    }
    
    // もし手で描画中にペンが触れたら、手の描画を中断してペンに切り替える（優先）
    this.activePointerType = e.pointerType;
    this.isDrawing = true;

    // PointerCaptureをセットすることで、キャンバス外に指が出てもイベントをトラッキングし続ける
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}

    const pos = this._getPos(e);
    this.lastPressure = this._getPressure(e);
    if (this.lastPressure === 0 && e.pointerType === 'pen') this.lastPressure = 0.1;
    this.currentPath = [{ x: pos.x, y: pos.y, p: this.lastPressure }];
    
    if (this.onStrokeStart) this.onStrokeStart();
  }

  _drawLiveSegment() {
    const pts = this.currentPath;
    const len = pts.length;
    if (len < 2) {
      if (len === 1 && !this.isDrawing) {
        this.ctx.beginPath();
        this.ctx.arc(pts[0].x, pts[0].y, (this.penSize * pts[0].p * 1.5) / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.penColor;
        this.ctx.fill();
      }
      return;
    }
    
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    const p0 = pts[len - 2];
    const p1 = pts[len - 1];
    
    this.ctx.beginPath();
    this.ctx.moveTo(p0.x, p0.y);
    this.ctx.lineTo(p1.x, p1.y);
    this.ctx.lineWidth = this.penSize * p1.p * 1.5;
    this.ctx.stroke();
  }

  _onMove(e) {
    if (!this.isDrawing) return;
    
    // このストロークを始めたポインター以外（手のひらなど）のイベントは完全に無視する（完璧なパームリジェクション）
    if (e.pointerType !== this.activePointerType) return;
    
    e.preventDefault();

    const addPoint = (ev) => {
      const pos = this._getPos(ev);
      let p = this._getPressure(ev);
      this.lastPressure = this.lastPressure * 0.4 + p * 0.6; // よりレスポンスよく

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
    // 違うポインター（手など）が離れたイベントは無視
    if (e.pointerType !== this.activePointerType) return;
    
    this.isDrawing = false;
    
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) {}

    const pos = this._getPos(e);
    let p = this._getPressure(e);
    this.currentPath.push({ x: pos.x, y: pos.y, p: p });
    this._drawLiveSegment();



    if (this.currentPath.length > 0) {
      this.paths.push({ points: [...this.currentPath], penSize: this.penSize, color: this.penColor });
      this.undoStack.push('path');
    }
    this.currentPath = [];
    
    if (this.onStrokeEnd) this.onStrokeEnd();
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
    const tmpCanvas = document.createElement('canvas');
    const scale = Math.min(600 / this.canvas.width, 600 / this.canvas.height, 1);
    const W = Math.round(this.canvas.width * scale) || 600;
    const H = Math.round(this.canvas.height * scale) || 600;
    
    tmpCanvas.width = W; 
    tmpCanvas.height = H;
    const tmpCtx = tmpCanvas.getContext('2d');

    // 完全な白背景
    tmpCtx.fillStyle = '#ffffff';
    tmpCtx.fillRect(0, 0, W, H);

    const dpr = window.devicePixelRatio || 1;
    tmpCtx.scale(W / (this.canvas.width / dpr), H / (this.canvas.height / dpr));

    // OCR用に、点線のガイドを排除し、真っ黒で一定の太さの線を描画する関数
    const drawForOCR = (path) => {
      const pts = path.points;
      if (pts.length === 0) return;
      tmpCtx.strokeStyle = '#000000'; // コントラスト最大化
      tmpCtx.lineCap = 'round';
      tmpCtx.lineJoin = 'round';

      if (pts.length === 1) {
        tmpCtx.beginPath();
        tmpCtx.arc(pts[0].x, pts[0].y, path.penSize / 2, 0, Math.PI * 2);
        tmpCtx.fillStyle = '#000000';
        tmpCtx.fill();
        return;
      }

      tmpCtx.beginPath();
      tmpCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        tmpCtx.lineTo(pts[i].x, pts[i].y);
      }
      // 筆圧に依存せず、少し太めで一定の線を書く（かすれによる認識漏れを防ぐ）
      tmpCtx.lineWidth = path.penSize * 1.5;
      tmpCtx.stroke();
    };

    this.paths.forEach(p => drawForOCR(p));
    if (this.currentPath.length > 0) {
      drawForOCR({ points: this.currentPath, penSize: this.penSize });
    }

    const dataURL = tmpCanvas.toDataURL('image/png');
    return dataURL.split(',')[1];
  }

  resize() { this._resize(); }
}
