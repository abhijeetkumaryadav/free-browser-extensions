#!/usr/bin/env python3
"""Render an animated vertical demo reel for Inspo Collector (720x1280, 12fps)."""
import math, os
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 720, 1280, 12
OUT = "/tmp/reel_frames"
os.makedirs(OUT, exist_ok=True)

BG=(20,16,26); PANEL=(30,24,38); INK=(243,236,247); MUTED=(168,155,181)
ACCENT=(201,123,142); ADEEP=(142,74,94); LINE=(44,35,55); TAGBG=(44,35,55)
PAGE=(24,20,32)

FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
FR = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
FS = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
FBIG = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 54)
FCAP = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)

def grad_photo(w,h,c1,c2):
    im=Image.new("RGB",(w,h)); px=im.load()
    for yy in range(h):
        t=yy/max(h-1,1)
        for xx in range(w):
            t2=min(1.0,(t+xx/w*0.35)/1.35)
            px[xx,yy]=tuple(int(c1[i]+(c2[i]-c1[i])*t2) for i in range(3))
    return im

PHOTOS=[grad_photo(315,240,*c) for c in
        [((142,47,60),(232,200,116)),((58,42,26),(201,168,106)),
         ((122,31,43),(229,199,107)),((40,60,90),(120,170,200))]]
PHOTO_LABELS=["Diwali saree looks","Gold jewellery","Zardozi work","Evening glam"]

def draw_cursor(d,x,y,s=1.3):
    pts=[(0,0),(0,44),(11,33),(17,42),(21,39),(15,30),(25,30)]
    pts=[(x+px*s,y+py*s) for px,py in pts]
    d.polygon(pts,fill=(255,255,255),outline=(0,0,0))

def caption(d,text,alpha=255):
    if not text: return
    bb=d.textbbox((0,0),text,font=FCAP)
    tw=bb[2]-bb[0]+48; th=64
    x=(W-tw)//2; y=H-140
    overlay=Image.new("RGBA",(W,H),(0,0,0,0))
    od=ImageDraw.Draw(overlay)
    od.rounded_rectangle([x,y,x+tw,y+th],radius=16,fill=(0,0,0,170))
    base=d._image if hasattr(d,'_image') else None
    img=d.im if False else None
    # composite
    bg=Image.new("RGBA",(W,H),(0,0,0,0))
    return overlay, (x,y,tw,th,text)

def ease(t):
    t=max(0.0,min(1.0,t)); return t*t*(3-2*t)

def lerp(a,b,t): return a+(b-a)*t

# ---------- static webpage ----------
def webpage():
    img=Image.new("RGB",(W,H),PAGE); d=ImageDraw.Draw(img)
    d.rectangle([0,0,W,92],fill=(16,12,22))  # browser bar
    for i,c in enumerate([(255,95,86),(255,189,46),(39,201,63)]):
        d.ellipse([24+i*28,36,24+i*28+16,52],fill=c)
    d.rounded_rectangle([120,28,560,64],radius=18,fill=(40,32,52))
    d.text((300,36),"pinterest.com/festive-edit",font=FS,fill=MUTED,anchor="mm")
    # extension icon in toolbar
    d.rounded_rectangle([636,28,692,64],radius=10,fill=ADEEP)
    d.text((664,46),"◆",font=FS,fill=(255,255,255),anchor="mm")
    d.text((40,120),"Festive saree inspiration",font=FB,fill=INK)
    d.text((40,158),"2,431 pins  •  curated boards",font=FR,fill=MUTED)
    for i,(ph,label) in enumerate(zip(PHOTOS,PHOTO_LABELS)):
        cx=30+(i%2)*(315+30); cy=210+(i//2)*(240+64)
        mask=Image.new("L",(315,240),0)
        ImageDraw.Draw(mask).rounded_rectangle([0,0,314,239],radius=18,fill=255)
        img.paste(ph,(cx,cy),mask)
        d.text((cx+14,cy+240+10),label,font=FR,fill=INK)
    return img

WEBPAGE=webpage()

# ---------- popup gallery (pre-rendered, slides up) ----------
def popup_panel():
    w=720; h=900
    img=Image.new("RGB",(w,h),BG); d=ImageDraw.Draw(img)
    d.text((24,18),"◆",font=FB,fill=ACCENT)
    d.text((58,18),"Inspo Collector",font=FB,fill=INK)
    d.rounded_rectangle([24,62,w-24,104],radius=12,fill=PANEL,outline=LINE)
    d.text((44,72),"Search tags or titles…",font=FR,fill=MUTED)
    pills=[("Festive Edit (4)",True),("Glow Routine (2)",False),("Unsorted (1)",False)]
    x=24; y=122
    for name,act in pills:
        bb=d.textbbox((0,0),name,font=FS); pw=bb[2]-bb[0]+36
        d.rounded_rectangle([x,y,x+pw,y+40],radius=20,fill=ADEEP if act else PANEL,outline=ADEEP if act else LINE)
        d.text((x+18,y+9),name,font=FS,fill=(255,255,255) if act else MUTED); x+=pw+10
    cards=[
        dict(tags=["diwali","saree","gold"],pal=["#8e2f3c","#d4a017","#2b1a22","#e8c874","#5c1f2e"],cols=((142,47,60),(232,200,116)),new=True),
        dict(tags=["attar","oud","campaign"],pal=["#3a2a1a","#8a6a3a","#14100c","#c9a86a","#5c4a2a"],cols=((58,42,26),(201,168,106)),new=False),
        dict(tags=["zardozi","heritage"],pal=["#7a1f2b","#c9962e","#2e1a1e","#e5c76b","#4a2a20"],cols=((122,31,43),(229,199,107)),new=False),
        dict(tags=["glow","skincare"],pal=["#e8b4a0","#c97b8e","#8e4a5e","#f3e0d0","#5c2e3e"],cols=((232,180,160),(142,74,94)),new=False),
    ]
    cw=(w-48-16)//2; chh=330; gy=180
    for idx,c in enumerate(cards):
        cx=24+(idx%2)*(cw+16); cy=gy+(idx//2)*(chh+16)
        d.rounded_rectangle([cx,cy,cx+cw,cy+chh],radius=16,fill=PANEL,outline=LINE)
        ph=grad_photo(cw,190,*c["cols"])
        mask=Image.new("L",(cw,190),0)
        ImageDraw.Draw(mask).rounded_rectangle([0,0,cw-1,189],radius=16,fill=255)
        img.paste(ph,(cx,cy),mask)
        if c["new"]:
            d.rounded_rectangle([cx+cw-92,cy+12,cx+cw-12,cy+40],radius=10,fill=ACCENT)
            d.text((cx+cw-52,cy+26),"NEW",font=FS,fill=(255,255,255),anchor="mm")
        ty=cy+202; tx=cx+12
        for t in c["tags"]:
            bb=d.textbbox((0,0),t,font=FS); pw=bb[2]-bb[0]+22
            d.rounded_rectangle([tx,ty,tx+pw,ty+30],radius=15,fill=TAGBG)
            d.text((tx+11,ty+5),t,font=FS,fill=MUTED); tx+=pw+8
        ty+=42; sx=cx+12
        for hexcol in c["pal"]:
            rgb=tuple(int(hexcol[i:i+2],16) for i in (1,3,5))
            d.rounded_rectangle([sx,ty,sx+24,ty+24],radius=7,fill=rgb,outline=(255,255,255)); sx+=32
        ty+=40; bw=(cw-24-10)//2
        for i,label in enumerate(["Source ↗","Delete"]):
            bx=cx+12+i*(bw+10)
            d.rounded_rectangle([bx,ty,bx+bw,ty+38],radius=10,outline=LINE)
            bb=d.textbbox((0,0),label,font=FS)
            d.text((bx+(bw-(bb[2]-bb[0]))/2,ty+8),label,font=FS,fill=MUTED)
    d.rectangle([0,h-70,w,h],fill=BG); d.line([0,h-70,w,h-70],fill=LINE)
    d.text((24,h-48),"4 saved",font=FR,fill=MUTED)
    for i,label in enumerate(["Export","+ Board"]):
        bb=d.textbbox((0,0),label,font=FR); pw=bb[2]-bb[0]+36
        bx=w-24-pw if i==0 else w-24-pw-12-(d.textbbox((0,0),"Export",font=FR)[2]+36)
        d.rounded_rectangle([bx,h-58,bx+pw,h-18],radius=10,fill=PANEL,outline=LINE)
        d.text((bx+18,h-50),label,font=FR,fill=INK)
    return img

POPUP=popup_panel()

def endcard():
    img=Image.new("RGB",(W,H))
    px=img.load()
    for yy in range(H):
        t=yy/H
        px[0,yy]=(0,0,0)  # placeholder loop replaced below
    # vertical gradient plum -> rose dark
    top=(30,20,40); bot=(90,45,60)
    for yy in range(H):
        t=yy/max(H-1,1)
        c=tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3))
        for xx in range(W): px[xx,yy]=c
    d=ImageDraw.Draw(img)
    d.text((W//2,520),"◆",font=FBIG,fill=ACCENT,anchor="mm")
    d.text((W//2,620),"Inspo Collector",font=FBIG,fill=INK,anchor="mm")
    d.text((W//2,690),"Right-click. Save. Create.",font=FB,fill=MUTED,anchor="mm")
    d.text((W//2,780),"v1.0.0  •  Chrome  •  Edge  •  Firefox  •  Opera",font=FS,fill=MUTED,anchor="mm")
    return img
END=endcard()

# ---------- timeline ----------
TOTAL=192
def scene_of(f):
    if f<30: return "browse"
    if f<54: return "menu"
    if f<84: return "pick"
    if f<108: return "toast"
    if f<122: return "opengal"
    if f<168: return "gallery"
    return "end"

CAPTIONS={
 "browse":"You're browsing for festive inspiration…",
 "menu":"Right-click any image…",
 "pick":"…and save it to a board.",
 "toast":"Tags + color palette saved automatically.",
 "opengal":"Open the gallery…",
 "gallery":"Everything lands in your boards.",
 "end":"",
}

def render(f):
    scene=scene_of(f)
    if scene=="end":
        img=END.copy()
    else:
        img=WEBPAGE.copy()
    d=ImageDraw.Draw(img,"RGBA")

    # progress bar
    d.rectangle([0,0,W* (f+1)/TOTAL,6],fill=ACCENT)

    if scene=="browse":
        t=ease(f/29)
        cx=lerp(620,200,t); cy=lerp(1150,330,t)
        draw_cursor(d,cx,cy)
    elif scene=="menu":
        draw_cursor(d,200,330)
        s=ease((f-30)/6)
        mw,mh=int(330*s),int(64*s)
        if mw>10:
            mx,my=220,340
            d.rounded_rectangle([mx,my,mx+mw,my+mh],radius=12,fill=(40,32,52),outline=LINE)
            if s>0.7:
                d.text((mx+20,my+18),"Save image to Inspo Board  ▸",font=FR,fill=INK)
    elif scene=="pick":
        draw_cursor(d,200,330)
        mx,my=220,340
        d.rounded_rectangle([mx,my,mx+330,my+64],radius=12,fill=(40,32,52),outline=LINE)
        d.text((mx+20,my+18),"Save image to Inspo Board  ▸",font=FR,fill=INK)
        sx,sy=470,404
        items=["Festive Edit","Glow Routine","Unsorted","+ New board…"]
        sh=len(items)*52+16
        d.rounded_rectangle([sx,sy,sx+230,sy+sh],radius=12,fill=(40,32,52),outline=LINE)
        lf=f-54
        hi = 0 if lf>=12 else -1
        for i,name in enumerate(items):
            iy=sy+8+i*52
            if i==hi and lf>=12:
                d.rounded_rectangle([sx+6,iy,sx+224,iy+48],radius=8,fill=ADEEP)
            d.text((sx+22,iy+12),name,font=FR,fill=(255,255,255) if i==hi else INK)
        if lf>=24:  # click flash on Festive Edit
            t2=(lf-24)/6
            if t2<1:
                r=int(10+t2*40)
                d.ellipse([sx+115-r, sy+32-r, sx+115+r, sy+32+r],outline=(255,255,255,int(200*(1-t2))),width=3)
    elif scene=="toast":
        t=(f-84)/24
        alpha=int(255*min(1,t*3)*min(1,(1-t)*4+0.2))
        y_off=int(30*(1-ease(min(1,t*3))))
        txt="✓  Saved to Festive Edit"
        bb=d.textbbox((0,0),txt,font=FB)
        tw=bb[2]-bb[0]+64; th=72
        x=(W-tw)//2; y=560+y_off
        d.rounded_rectangle([x,y,x+tw,y+th],radius=36,fill=(30,24,38,alpha),outline=(142,74,94,alpha))
        # draw text with alpha via overlay
        ov=Image.new("RGBA",(W,H),(0,0,0,0)); od=ImageDraw.Draw(ov)
        od.text((x+32,y+20),txt,font=FB,fill=(243,236,247,alpha))
        img2=Image.alpha_composite(img.convert("RGBA"),ov).convert("RGB")
        img.paste(img2)
        d=ImageDraw.Draw(img,"RGBA")
    elif scene=="opengal":
        t=ease((f-108)/13)
        cx=lerp(200,664,t); cy=lerp(330,46,t)
        draw_cursor(d,cx,cy)
        if f>=118:
            p=ease((f-118)/4)
            ph=int(900*p)
            if ph>0:
                crop=POPUP.crop((0,900-ph,720,900))
                img.paste(crop,(0,H-ph))
    elif scene=="gallery":
        img.paste(POPUP,(0,H-900))

    # caption
    cap=CAPTIONS[scene]
    if cap:
        ov=Image.new("RGBA",(W,H),(0,0,0,0)); od=ImageDraw.Draw(ov)
        bb=od.textbbox((0,0),cap,font=FCAP)
        tw=bb[2]-bb[0]+56; th=72; x=(W-tw)//2; y=H-150
        od.rounded_rectangle([x,y,x+tw,y+th],radius=18,fill=(0,0,0,175))
        od.text((x+28,y+18),cap,font=FCAP,fill=(255,255,255,255))
        img=Image.alpha_composite(img.convert("RGBA"),ov).convert("RGB")

    img.save(f"{OUT}/frame_{f:03d}.png")

for f in range(TOTAL):
    render(f)
    if f%48==0: print(f"frame {f}/{TOTAL}")
print("done")
