"""Paint new water cels over the coast art and write an editable LibreSprite file."""
from pathlib import Path
import math
import random
import struct
import zlib
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
art = root / 'assets/bramble-cay-melomys/pixel-art'
width, height = 768, 256
original = Image.open(root / 'public/art/coast-now.webp').convert('RGBA')
original = original.resize((width, height), Image.Resampling.NEAREST)
mask = Image.new('L', (width, height))
pen = ImageDraw.Draw(mask)
pen.polygon([(0,106),(49,106),(78,119),(173,124),(232,117),(278,110),(350,123),
             (392,119),(436,125),(462,124),(492,130),(530,128),(565,124),(614,121),
             (646,130),(680,131),(720,125),(767,122),(767,255),(0,255)], fill=255)
for outline in [
    [(241,151),(242,138),(248,132),(254,133),(257,149)],
    [(314,154),(314,139),(317,135),(328,135),(329,151)],
    [(462,126),(462,111),(470,111),(470,124)],
    [(486,130),(511,103),(536,103),(519,131)],
    [(550,126),(550,110),(559,110),(559,126)],
    [(577,127),(577,111),(585,111),(585,125)],
    [(613,124),(613,107),(621,107),(621,123)],
    [(433,255),(433,232),(441,225),(471,225),(476,255)],
    [(489,221),(489,165),(494,159),(513,159),(521,165),(519,206)],
    [(454,255),(539,177),(672,176),(768,251),(768,256)],
    [(652,183),(652,165),(660,162),(672,163),(678,195)],
    [(725,223),(726,205),(757,203),(768,209),(768,253)],
]:
    pen.polygon(outline, fill=0)

base = Image.new('RGBA', (width,height))
draw = ImageDraw.Draw(base)
for y in range(104,height):
    depth = (y-104)/152
    color = tuple(round(a+(b-a)*depth) for a,b in zip((51,83,83),(35,70,72)))
    draw.line((0,y,width,y), fill=color)
rng = random.Random(54)
for _ in range(3600):
    x,y = rng.randrange(width),rng.randrange(105,height)
    length = rng.randrange(2,5+int((y-100)*.14))
    color = rng.choice(('#36585a','#3e6263','#416668','#305356','#294b4f','#507475'))
    if x<200 and rng.random()<.43:
        color = rng.choice(('#946958','#ae7863','#5a6260','#66645e'))
    draw.rectangle((x,y,min(width-1,x+length),y+int(y>190 and rng.random()<.24)),fill=color)

# Keep the painted colors and shadows of the water. Clear the bright crests
# from this layer so their silhouettes come from the individual animation cels.
underpainting = base.copy()
for y in range(105, height):
    for x in range(width):
        if not mask.getpixel((x, y)):
            continue
        red, green, blue, _ = original.getpixel((x, y))
        flat = underpainting.getpixel((x, y))
        bright_crest = max(0, min(1, (min(red, green) - 90) / 42))
        blend = 0.78 * (1 - bright_crest)
        base.putpixel((x,y), tuple(round(a+(b-a)*blend) for a,b in zip(flat,(red,green,blue,255))))

def wave(draw, y, shift, opacity, size):
    for x in range(-20,width+20,3):
        wobble = math.sin(x*.033 + shift) * size + math.sin(x*.07 + .6) * size*.37
        front = round(y + wobble)
        pattern = math.sin(x*.069+shift*1.6)+math.sin(x*.137+.5)+.5*math.sin(x*.25)
        draw.rectangle((x,front,x+4,front+max(2,round(size*.74))),fill='#3a6163')
        draw.rectangle((x,front-1,x+3,front+1),fill='#547979')
        if pattern + opacity > .64:
            draw.rectangle((x,front-1,x+3,front),fill='#769895')
        if pattern + opacity > 1.55:
            draw.line((x,front-1,x+2,front-1),fill='#bfccad')

def cel(index):
    frame = base.copy()
    draw = ImageDraw.Draw(frame)
    phase = index / 24
    for wave_number in range(3):
        position = (phase + wave_number/3) % 1
        distance = 1-position
        y = 120 + 156*distance**1.64
        strength = math.sin(math.pi*position)
        if 122 < y < 270:
            wave(draw,y,position*3+wave_number, strength,1.2+4.5*distance)
    # Draw the advancing wash, then replace it with broken patches on retreat.
    for x in range(226,644,2):
        near_house = x>=435
        if not near_house and not (226<=x<=265 or 295<=x<=349):
            continue
        contact = 132 if near_house else 151
        age = (phase + .56 + (x-470)*.0015) % 1
        swell = math.sin(math.pi*age)
        edge = round(contact + 10*swell - (5 if age<.35 else 0) +
                     2*math.sin(x*.29 + age*5))
        grain = math.sin(x*.73+age*9)+math.sin(x*.18-age*5)
        if grain > -.85:
            draw.line((x,edge,x+2,edge),fill='#70918d')
        if grain > .03 and .12<age<.85:
            draw.line((x,edge-1,x+2,edge-1),fill='#a7b7a0')
        if grain > .65 and .21<age<.57:
            draw.rectangle((x,edge-2,x+1,edge-1),fill='#d6d8b7')
            if index%4<2:
                draw.point((x-1,edge-4),fill='#d6d8b7')
    frame.putalpha(mask)
    return frame

def chunk(kind, body):
    return struct.pack('<IH',len(body)+6,kind)+body

def layer(name):
    encoded=name.encode()
    return chunk(0x2004, struct.pack('<7HB3xH',1,0,0,0,0,0,255,0,len(encoded)) + encoded)

def image_cel(index, image):
    return chunk(0x2005, struct.pack('<HhhBH7xHH',index,0,0,255,2,width,height) + zlib.compress(image.tobytes()))

frames = []
for index in range(24):
    water = image_cel(1, cel(index))
    chunks = [layer('Costa y madera'),layer('Oleaje dibujado'),image_cel(0,original),water] if index==0 else [
        chunk(0x2005,struct.pack('<HhhBH7xH',0,0,0,255,1,0)),water]
    body = b''.join(chunks)
    frames.append(struct.pack('<IHHH6x',len(body)+16,0xf1fa,len(chunks),100)+body)
payload=b''.join(frames)
header=bytearray(128)
struct.pack_into('<I5HIH',header,0,128+len(payload),0xa5e0,len(frames),width,height,32,1,100)
header[34:36]=bytes([1,1])
(art/'costa-oleaje.ase').write_bytes(header+payload)
