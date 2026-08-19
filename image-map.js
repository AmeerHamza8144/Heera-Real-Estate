(function(){
  "use strict";
  class HeeraImageMap{
    constructor(container,options={}){
      if(!container)throw new Error("A map container is required.");
      this.container=container;this.width=Number(options.width)||1;this.height=Number(options.height)||1;this.scale=1;this.minScale=1;this.maxScale=12;this.x=0;this.y=0;this.pointers=new Map();this.dragged=false;this.markers=[];
      container.classList.add("image-map-viewport");
      container.innerHTML=`<div class="image-map-stage"><img draggable="false" alt="${this.escape(options.alt||"Digital project map")}"><div class="image-map-markers"></div></div>`;
      this.stage=container.querySelector(".image-map-stage");this.image=container.querySelector("img");this.markerLayer=container.querySelector(".image-map-markers");
      this.stage.style.width=`${this.width}px`;this.stage.style.height=`${this.height}px`;this.image.src=options.image||"";this.image.addEventListener("load",()=>this.fit());this.bind();
      this.resizeObserver=new ResizeObserver(()=>this.fit(false));this.resizeObserver.observe(container);
    }
    escape(value){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);}
    setImage(image,width,height,alt="Digital project map"){this.width=Math.max(1,Number(width)||1);this.height=Math.max(1,Number(height)||1);this.stage.style.width=`${this.width}px`;this.stage.style.height=`${this.height}px`;this.image.alt=alt;this.image.src=image;this.setMarkers([]);if(this.image.complete)this.fit();}
    fit(reset=true){const r=this.container.getBoundingClientRect();if(!r.width||!r.height)return;this.minScale=Math.max(.0001,Math.min(r.width/this.width,r.height/this.height));this.maxScale=this.minScale*18;if(reset||this.scale<this.minScale){this.scale=this.minScale;this.x=(r.width-this.width*this.scale)/2;this.y=(r.height-this.height*this.scale)/2;}this.apply();}
    constrain(){const r=this.container.getBoundingClientRect(),w=this.width*this.scale,h=this.height*this.scale;this.x=w<=r.width?(r.width-w)/2:Math.min(0,Math.max(r.width-w,this.x));this.y=h<=r.height?(r.height-h)/2:Math.min(0,Math.max(r.height-h,this.y));}
    apply(){this.constrain();this.stage.style.transform=`translate3d(${this.x}px,${this.y}px,0) scale(${this.scale})`;this.markerLayer.style.setProperty("--map-counter-scale",String(1/this.scale));}
    zoomBy(factor,cx,cy){const r=this.container.getBoundingClientRect(),ax=cx??r.left+r.width/2,ay=cy??r.top+r.height/2,mx=(ax-r.left-this.x)/this.scale,my=(ay-r.top-this.y)/this.scale,next=Math.max(this.minScale,Math.min(this.maxScale,this.scale*factor));this.scale=next;this.x=ax-r.left-mx*next;this.y=ay-r.top-my*next;this.apply();}
    focus(nx,ny,intensity=8){const r=this.container.getBoundingClientRect();this.scale=Math.max(this.minScale,Math.min(this.maxScale,this.minScale*intensity));this.x=r.width/2-nx*this.width*this.scale;this.y=r.height/2-ny*this.height*this.scale;this.apply();}
    bind(){
      this.container.addEventListener("wheel",e=>{e.preventDefault();this.zoomBy(e.deltaY<0?1.18:.84,e.clientX,e.clientY);},{passive:false});
      this.container.addEventListener("pointerdown",e=>{if(e.button!==0&&e.pointerType==="mouse")return;this.container.setPointerCapture?.(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.dragged=false;if(this.pointers.size===1)this.panStart={x:e.clientX,y:e.clientY,tx:this.x,ty:this.y};if(this.pointers.size===2)this.startPinch();});
      this.container.addEventListener("pointermove",e=>{if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===1&&this.panStart){const dx=e.clientX-this.panStart.x,dy=e.clientY-this.panStart.y;if(Math.abs(dx)+Math.abs(dy)>4)this.dragged=true;this.x=this.panStart.tx+dx;this.y=this.panStart.ty+dy;this.apply();}else if(this.pointers.size===2&&this.pinchStart){const[a,b]=[...this.pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y)||1,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},r=this.container.getBoundingClientRect(),next=Math.max(this.minScale,Math.min(this.maxScale,this.pinchStart.scale*distance/this.pinchStart.distance));this.scale=next;this.x=mid.x-r.left-this.pinchStart.mapX*next;this.y=mid.y-r.top-this.pinchStart.mapY*next;this.dragged=true;this.apply();}});
      const end=e=>{this.pointers.delete(e.pointerId);if(this.pointers.size===1){const p=[...this.pointers.values()][0];this.panStart={x:p.x,y:p.y,tx:this.x,ty:this.y};}else this.panStart=null;this.pinchStart=null;};this.container.addEventListener("pointerup",end);this.container.addEventListener("pointercancel",end);
    }
    startPinch(){const[a,b]=[...this.pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},r=this.container.getBoundingClientRect();this.pinchStart={distance:Math.hypot(a.x-b.x,a.y-b.y)||1,scale:this.scale,mapX:(mid.x-r.left-this.x)/this.scale,mapY:(mid.y-r.top-this.y)/this.scale};}
    setMarkers(plots,options={}){this.markers=Array.isArray(plots)?plots:[];this.markerLayer.innerHTML="";this.markers.forEach(plot=>{const marker=document.createElement("button");marker.type="button";marker.className="map-plot-marker";marker.dataset.plotId=plot.id;marker.style.left=`${Number(plot.normalized_x)*this.width}px`;marker.style.top=`${Number(plot.normalized_y)*this.height}px`;marker.style.width=`${Math.max(9,Number(plot.marker_size)||25)}px`;marker.style.height=marker.style.width;marker.title=`${plot.block_name||plot.block||"Block"} · Plot ${plot.plot_number||""}`;marker.setAttribute("aria-label",marker.title);marker.addEventListener("pointerdown",e=>e.stopPropagation());marker.addEventListener("click",e=>{e.stopPropagation();options.onMarkerClick?.(plot,marker);});this.markerLayer.appendChild(marker);});}
    pulsePlot(id){const marker=this.markerLayer.querySelector(`[data-plot-id="${Number(id)}"]`);if(!marker)return;marker.classList.remove("map-pulse");requestAnimationFrame(()=>marker.classList.add("map-pulse"));setTimeout(()=>marker.classList.remove("map-pulse"),6000);}
    async toggleFullscreen(){if(document.fullscreenElement)return document.exitFullscreen?.();return this.container.closest(".map-fullscreen-shell")?.requestFullscreen?.()||this.container.requestFullscreen?.();}
  }
  window.HeeraImageMap=HeeraImageMap;
})();
