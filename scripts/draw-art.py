"""Draw the game's native-resolution tiles, furniture and character frames."""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / 'public' / 'art'
out.mkdir(parents=True, exist_ok=True)
rng = Random(39)
ink, wood, honey, cream = '#30242a', '#bd804a', '#e6aa64', '#fff0cd'
shade, wall, trim = '#7b4937', '#e8caa0', '#be966e'
green = ('#2b534b', '#4f7963', '#90a775')
rust = ('#75382f', '#b75d45', '#e18f68')
sea = ('#214753', '#2b6065', '#39777a', '#52968e')

def blank(w, h):
    picture = Image.new('RGBA', (w, h))
    return picture, ImageDraw.Draw(picture)

def box(d, x, y, w, h, fill):
    d.rectangle((x, y, x+w-1, y+h-1), fill=fill)

def oval(d, x, y, w, h, fill):
    d.ellipse((x,y,x+w-1,y+h-1), fill=fill)

def save(im, name):
    im.save(out / (name + '.png'))

tiles, _ = blank(16 * 12, 16)
for i in range(12):
    im, d = blank(16, 16)
    if i < 3:
        box(d,0,0,16,16,sea[i])
        for _ in range(6):
            x,y = rng.randrange(15),rng.randrange(16)
            box(d,x,y,rng.randrange(1,min(6,17-x)),1,sea[min(i+1,3)])
    elif i < 7:
        base = ['#d8b780','#daba83','#b3a15f','#9c9b5b'][i-3]
        box(d,0,0,16,16,base)
        for _ in range(10):
            x,y = rng.randrange(16),rng.randrange(16)
            d.point((x,y),fill=rng.choice(['#d1af76','#e8c793','#afb374'] if i<5 else ['#c2ab6c','#888854','#b7ae6b']))
        if i == 6:
            for x,y in [(3,11),(10,6),(14,14)]:
                d.line((x-1,y-3,x,y,x+1,y-4),fill='#6f784c')
    elif i < 11:
        box(d,0,0,16,16,['#ba824e','#c28a54','#c7945e','#9f6745'][i-7])
        for y in (1,9):
            box(d,0,y,16,1,shade)
            box(d,0,y+1,16,1,'#dda46b')
            x = (i*5+y)%15
            box(d,x,y+2,1,6,'#9c643e')
        for _ in range(4):
            x,y=rng.randrange(12),rng.choice([4,6,12,13,14])
            box(d,x,y,rng.randrange(1,5),1,'#a97348')
    else:
        box(d,0,0,16,16,'#211c24')
    tiles.paste(im,(i*16,0))
save(tiles,'tiles')

def window(d,x,y):
    box(d,x,y,16,18,shade)
    box(d,x+1,y+1,14,15,honey)
    box(d,x+3,y+3,10,11,'#dfb569')
    box(d,x+4,y+3,4,7,cream)
    box(d,x+7,y+2,2,13,shade)
    box(d,x+2,y+7,12,1,shade)
    box(d,x-1,y+15,18,3,wood)
    box(d,x-1,y+15,18,1,honey)

def cabin(name, roof):
    im,d=blank(144,112)
    dark,base,light=roof
    oval(d,3,88,138,20,'#a0845e')
    box(d,12,52,120,47,shade)
    box(d,15,55,114,38,wall)
    for y in range(56,93,6):
        box(d,15,y,114,1,trim)
        box(d,15,y+1,114,1,'#efcfa2')
        for x in range(20+y%3,120,15):
            if rng.random()<.45: box(d,x,y+3,rng.randrange(2,10),1,'#d7ac7b')
    for x in (13,126):
        box(d,x,54,5,43,wood)
        box(d,x,55,2,40,honey)
    box(d,94,6,13,23,shade)
    box(d,93,6,15,5,ink)
    box(d,96,11,7,12,rust[1])
    d.polygon([(5,54),(23,16),(34,11),(111,11),(120,17),(139,54),(136,61),(7,61)],fill=ink)
    d.polygon([(8,52),(26,17),(35,14),(109,14),(117,18),(135,53)],fill=base)
    for y in range(19,54,5):
        edge=25-(y-19)//2
        box(d,edge,y,144-2*edge,1,dark)
        box(d,edge,y+1,144-2*edge,1,light)
        for x in range(edge+4+(y%3)*3,140-edge,8):
            box(d,x,y+2,1,3,dark)
    box(d,8,55,128,4,dark)
    box(d,10,55,124,1,light)
    window(d,31,66)
    window(d,98,66)
    box(d,62,65,21,30,shade)
    box(d,65,67,15,28,'#a16342')
    box(d,67,69,11,10,'#553d38')
    box(d,68,70,9,8,honey)
    box(d,72,70,1,8,shade)
    box(d,77,84,2,2,cream)
    for y in (94,98,102):
        box(d,57,y,31,4,shade)
        box(d,58,y,29,1,honey)
    box(d,51,70,3,5,cream)
    box(d,50,68,5,2,shade)
    for x in (24,113):
        box(d,x,88,10,8,rust[0])
        box(d,x,88,10,2,rust[2])
        d.line((x+1,88,x+4,81,x+5,88,x+8,83),fill=green[0])
    save(im,name)

cabin('home',green)
cabin('house-red',rust)
cabin('house-green',('#304c49','#607c52','#95a377'))

room,d=blank(400,256)
box(d,24,22,352,55,shade)
box(d,28,25,344,40,wall)
box(d,28,26,344,2,cream)
for x in range(31,372,11):
    box(d,x,26,1,38,trim)
    for y in (31,48):
        d.line((x+3,y+2,x+4,y,x+5,y+2),fill='#d7b78b')
for y in (61,66,73):
    box(d,26,y,348,3,wood)
    box(d,26,y,348,1,honey)
for x in (24,370):
    box(d,x,22,6,212,shade)
    box(d,x+1,24,2,209,wood)
for x in (57,284):
    window(d,x,34)
    box(d,x-3,33,3,19,rust[1])
    box(d,x+16,33,3,19,rust[1])
box(d,184,35,20,15,shade)
box(d,186,37,16,11,cream)
d.polygon([(187,47),(194,40),(198,44),(200,42),(201,47)],fill=green[1])
box(d,28,230,148,5,shade)
box(d,224,230,149,5,shade)
box(d,176,226,48,9,wood)
box(d,178,229,44,1,honey)
# Woven rugs are floor decorations.
for x,y,w,h in [(140,92,115,88),(175,198,50,23)]:
    box(d,x,y,w,h,rust[0])
    box(d,x+1,y+1,w-2,h-2,rust[2])
    box(d,x+4,y+3,w-8,h-6,rust[1])
    for xx in range(x+7,x+w-5,7):
        for yy in (y+5,y+h-7):
            d.polygon([(xx,yy-1),(xx+2,yy+1),(xx,yy+3),(xx-2,yy+1)],fill=wall)
    for yy in range(y+8,y+h-7,7):
        for xx in (x+7,x+w-8):
            d.point((xx,yy),fill=wall)
save(room,'room')

im,d=blank(96,48)
oval(d,2,19,92,28,'#914d3e')
for x in (12,80):
    box(d,x,20,5,23,shade)
    box(d,x,23,2,17,honey)
oval(d,1,0,94,34,shade)
oval(d,2,0,92,30,honey)
oval(d,5,2,86,24,wood)
for x in (21,43,65):
    oval(d,x,7,13,9,cream)
    oval(d,x+3,9,7,4,'#eba967')
oval(d,43,16,14,9,cream)
oval(d,47,18,6,4,rust[2])
box(d,31,16,5,5,green[1])
box(d,62,17,6,6,rust[0])
box(d,61,17,8,2,honey)
save(im,'table')

im,d=blank(144,64)
# Stove, countertop and sink.
box(d,2,8,138,48,shade)
for x in range(5,139,18):
    box(d,x,30,15,22,wood)
    box(d,x+1,32,13,1,honey)
    box(d,x+7,37,4,1,ink)
box(d,3,11,136,17,trim)
box(d,3,11,136,2,cream)
box(d,6,12,29,16,ink)
for x in (9,20):
    for y in (14,21):
        oval(d,x,y,8,5,'#655154')
box(d,39,15,24,10,'#5a6157')
box(d,41,16,20,7,'#8b9e88')
box(d,48,11,2,7,green[0])
box(d,84,13,18,11,honey)
oval(d,88,14,10,7,cream)
for x in (112,124):
    box(d,x,9,7,15,green[1])
    box(d,x,8,7,2,honey)
save(im,'kitchen')

im,d=blank(80,64)
box(d,2,3,73,53,shade)
box(d,4,4,69,48,wood)
box(d,6,7,65,41,ink)
for y in (9,23,37):
    box(d,6,y+11,65,3,wood)
    box(d,6,y+11,65,1,honey)
    for x in range(9,70,5):
        if rng.random()<.83:
            col=rng.choice([green[1],green[2],rust[1],rust[2],cream,trim])
            ht=rng.randrange(5,11)
            box(d,x,y+11-ht,3,ht,col)
            box(d,x,y+12-ht,3,1,honey)
save(im,'books')

im,d=blank(80,64)
for x in (7,69):
    box(d,x,34,6,24,shade)
    box(d,x,37,2,19,honey)
box(d,2,24,76,16,shade)
box(d,3,22,74,13,wood)
box(d,3,22,74,2,honey)
box(d,13,2,30,24,ink)
box(d,15,3,25,20,trim)
box(d,17,5,20,15,'#203e42')
for y,w in [(8,7),(10,13),(13,10)]:
    box(d,19,y,w,1,'#7bba94')
box(d,11,26,37,5,cream)
box(d,13,27,32,2,trim)
box(d,52,25,18,5,rust[1])
box(d,55,23,16,3,cream)
save(im,'desk')

im,d=blank(32,48)
box(d,12,7,8,38,shade)
box(d,15,8,3,35,wood)
box(d,3,43,26,4,shade)
for x,y in ((8,11),(20,14)):
    box(d,x,y,6,3,honey)
    box(d,x,y-2,2,3,wood)
save(im,'rack')
im,d=blank(16,16)
oval(d,1,8,14,6,shade)
oval(d,2,7,12,6,honey)
oval(d,5,3,7,8,wood)
box(d,5,8,7,2,green[0])
save(im,'hat')

im,d=blank(32,32)
box(d,2,13,28,17,shade)
box(d,2,12,28,2,honey)
box(d,6,4,21,12,ink)
box(d,8,6,17,7,trim)
box(d,9,7,7,4,'#5a4540')
for y in (8,10): box(d,10,y,5,1,wall)
box(d,19,8,3,3,honey)
d.line((23,4,29,0),fill=cream)
save(im,'radio')

im,d=blank(32,32)
box(d,3,7,26,21,'#45645c')
box(d,4,8,23,2,'#8ba386')
oval(d,3,3,26,8,'#425e55')
oval(d,6,4,20,5,'#768f77')
box(d,4,20,24,2,'#35544c')
box(d,4,25,24,2,'#35544c')
box(d,20,23,5,2,cream)
save(im,'tank')

im,d=blank(16,16)
box(d,3,3,10,8,wood)
box(d,3,3,10,2,honey)
box(d,3,10,2,5,shade)
box(d,11,10,2,5,shade)
save(im,'chair')

for name,fur,tone,short in [
    ('mother',('#6e4438','#b97955','#f2cda3'),green,False),
    ('father',('#714537','#a76b4d','#efd0a9'),green,False),
    ('luz',('#79493b','#c48961','#ffdab2'),rust,True),
    ('nico',('#855143','#c38259','#f2cea3'),('#3b5267','#648398','#a4c4c1'),True),
    ('ada',('#69483e','#a97866','#e4b39c'),('#64445a','#95687b','#cf9e9e'),False),
    ('eli',('#6f534b','#ac886f','#efd2af'),('#4a5c60','#68847c','#a3ad87'),False),
]:
    shadow,mid,light=fur
    low,base,high=tone
    sheet,_=blank(64,128)
    h=5 if short else 0
    for row in range(4):
        for f in range(4):
            frame,d=blank(16,32)
            dx=(-1 if row==1 else 1) if row in (1,2) else 0
            bob=1 if f in (1,3) else 0
            y=h+bob
            # Tail, shoes and knit sweater.
            tail=([(11,26),(14,26),(15,23),(14,21)] if row!=2 else [(4,26),(1,26),(0,23),(1,21)])
            d.line(tail,fill=shadow,width=2)
            d.line(tail[1:],fill=mid)
            box(d,4,27-int(f==1),3,3,ink)
            box(d,9,27-int(f==3),3,3,ink)
            oval(d,3,17+y,10,12-y,low)
            box(d,5,20+y,6,6-y//2,base)
            box(d,4,21+y,2,3,high)
            if row!=3: d.line((6,23+y//2,7,24+y//2,8,23+y//2,9,24+y//2,10,23+y//2),fill=cream)
            for x in (1,10):
                oval(d,x+dx,6+y,5,6,shadow)
                oval(d,x+dx+1,7+y,3,4,'#ce947d')
            oval(d,2+dx,8+y,12,13,shadow)
            oval(d,3+dx,8+y,10,11,mid)
            if row==3:
                box(d,5,10+y,6,2,'#cd9165')
            else:
                oval(d,4+dx*2,13+y,8,7,light)
                eyes=[(5,13),(10,13)] if row==0 else ([(4,13)] if row==1 else [(11,13)])
                for x,ey in eyes:
                    box(d,x,ey+y,1,2,ink)
                box(d,7+dx*3,16+y,2,1,shadow)
                d.point((8+dx*3,17+y),fill=shadow)
            if name=='mother':
                box(d,3+dx,10+y,3,2,honey)
            sheet.paste(frame,(f*16,row*32))
    save(sheet,name)
    portrait,d=blank(64,64)
    box(d,0,0,64,64,'#d7bf93')
    oval(d,10,5,44,44,'#e8d4aa')
    oval(d,12,46,43,33,low)
    oval(d,17,47,33,22,base)
    for x in (22,29,36,43):
        d.line((x,57,x+2,59,x+4,57),fill=cream,width=2)
    for x in (8,41):
        oval(d,x,10,15,18,shadow)
        oval(d,x+3,13,9,11,'#d18b79')
    oval(d,12,13,41,36,shadow)
    oval(d,14,13,37,32,mid)
    oval(d,17,15,24,15,mid)
    oval(d,20,29,26,17,light)
    for x in (23,41):
        oval(d,x,26,4,6,ink)
        d.point((x+1,27),fill=cream)
    oval(d,31,33,6,4,shadow)
    d.line((34,36,34,39,31,40),fill=shadow)
    if name=='mother':
        box(d,14,20,7,2,honey)
        box(d,16,18,2,6,cream)
    save(portrait,name+'-portrait')

im,d=blank(64,64)
box(d,0,0,64,64,'#d7bf93')
oval(d,9,9,46,46,'#e8d4aa')
with Image.open(out/'radio.png') as radio:
    im.alpha_composite(radio.resize((48,48),Image.Resampling.NEAREST),(8,6))
save(im,'radio-portrait')

source = Path(__file__).resolve().parents[1] / 'assets' / 'bramble-cay-melomys' / 'pixel-art'
# The artist's strips contain single poses and three-quarter turnarounds, not a walk cycle.
for name, filename, front, left, right, back, max_size in [
    ('mother', 'pj2.png', 6, 4, 0, 2, (30, 28)),
    ('luz', 'cabin/pj3.png', 0, 6, 2, 4, (24, 23)),
    ('nico', 'cabin/pj4.png', 0, 6, 2, 4, (24, 23)),
]:
    original = Image.open(source / filename).convert('RGBA')
    sheet, _ = blank(128, 128)
    for row, pose in enumerate((front, left, right, back)):
        frame = original.crop((pose * 48, 0, (pose + 1) * 48, 48))
        bounds = frame.getbbox()
        frame = frame.crop(bounds)
        # Fit the subject in the field frame. Keep the full original strip separately.
        frame.thumbnail(max_size, Image.Resampling.NEAREST)
        for column in range(4):
            lift = column % 2
            x = column * 32 + (32 - frame.width) // 2
            y = row * 32 + 30 - frame.height - lift
            sheet.alpha_composite(frame, (x, y))
    save(sheet, name)
    portrait, d = blank(64, 64)
    box(d, 0, 0, 64, 64, '#d7bf93')
    oval(d, 6, 6, 52, 52, '#e8d4aa')
    frame = original.crop((front * 48, 0, (front + 1) * 48, 48))
    frame = frame.crop(frame.getbbox())
    portrait.alpha_composite(frame, ((64 - frame.width) // 2, (64 - frame.height) // 2))
    save(portrait, name + '-portrait')

cabin = source / 'cabin'
sheet, _ = blank(256, 128)
for row, (direction, anchor) in enumerate([
    ('down', (27, 48)), ('left', (29, 51)), ('right', (32, 51)), ('up', (28, 47)),
]):
    strip = Image.open(cabin / f'father-{direction}.png').convert('RGBA')
    cell = strip.width // 8
    # Use the same feet anchor throughout a direction to keep the real stride.
    for column in range(8):
        frame = strip.crop((column * cell, 0, (column + 1) * cell, strip.height))
        window = (anchor[0] - 23, anchor[1] - 42, anchor[0] + 23, anchor[1] + 4)
        frame = frame.crop(window).resize((32, 32), Image.Resampling.NEAREST)
        sheet.alpha_composite(frame, (column * 32, row * 32))
save(sheet, 'father')

for name in ('mother', 'father'):
    pair = Image.open(cabin / f'{name}-dialogue.png').convert('RGBA')
    for column, suffix in enumerate(('portrait', 'portrait-open')):
        frame = pair.crop((column * 128, 0, (column + 1) * 128, 256))
        frame = frame.crop(frame.getbbox())
        frame.thumbnail((61, 61), Image.Resampling.NEAREST)
        portrait, d = blank(64, 64)
        box(d, 0, 0, 64, 64, '#d7bf93')
        oval(d, 3, 3, 58, 58, '#e8d4aa')
        portrait.alpha_composite(frame, ((64 - frame.width) // 2, 64 - frame.height))
        save(portrait, f'{name}-{suffix}')

room = Image.open(cabin / 'cottage-kitchen.png').convert('RGBA')
empty = Image.open(cabin / 'cottage-kitchen-no-furniture.png').convert('RGBA')
# Separate the table and chairs so actors can stand behind them.
back_chairs, _ = blank(90, 29)
for x0, x1 in [(104, 127), (143, 169)]:
    for y in range(95, 124):
        for x in range(x0, x1):
            pixel = room.getpixel((x, y))
            floor = empty.getpixel((x, y))
            if pixel != floor:
                back_chairs.putpixel((x - 90, y - 95), pixel)
                room.putpixel((x, y), floor)
save(back_chairs, 'cabin-back-chairs')
for name, top, bottom in [('cabin-table', 95, 154), ('cabin-chairs', 154, 197)]:
    furniture, _ = blank(90, bottom - top)
    for y in range(top, bottom):
        for x in range(90, 180):
            pixel = room.getpixel((x, y))
            floor = empty.getpixel((x, y))
            if pixel != floor:
                furniture.putpixel((x - 90, y - top), pixel)
                room.putpixel((x, y), floor)
    save(furniture, name)
save(room, 'room')

door, d = blank(32, 56)
box(d, 2, 3, 28, 49, ink)
box(d, 4, 4, 24, 47, shade)
box(d, 6, 6, 20, 43, wood)
box(d, 7, 7, 18, 40, '#6c5340')
for x in (8, 13, 18, 23):
    box(d, x, 10, 1, 36, '#8d6347')
box(d, 9, 14, 14, 12, green[0])
box(d, 10, 15, 12, 9, green[1])
box(d, 13, 17, 6, 4, cream)
box(d, 21, 34, 3, 3, honey)
box(d, 2, 50, 28, 3, honey)
save(door, 'office-door')

study = source / 'office'
office = Image.open(study / 'cottage-study.png').convert('RGBA')
empty_office = Image.open(study / 'cottage-study-no-furniture.png').convert('RGBA')
# Keep the room composition and isolate the original furnishing pixels for depth sorting.
for name, left, top, right, bottom in [
    ('desk', 96, 69, 161, 124),
    ('chair', 115, 124, 140, 146),
    ('shelf', 203, 48, 240, 112),
    ('plant', 17, 145, 47, 208),
    ('cabinet', 216, 153, 240, 208),
]:
    layer, _ = blank(right - left, bottom - top)
    for y in range(top, bottom):
        for x in range(left, right):
            pixel = office.getpixel((x, y))
            background = empty_office.getpixel((x, y))
            if pixel != background:
                layer.putpixel((x - left, y - top), pixel)
                office.putpixel((x, y), background)
    save(layer, 'office-' + name)
save(office, 'office-room')

rug, d = blank(42, 23)
box(d, 2, 1, 38, 20, '#7b4937')
box(d, 3, 2, 36, 18, '#4f7963')
d.rectangle((5, 4, 36, 17), outline='#90a775')
for x in range(4, 39, 3):
    box(d, x, 0, 1, 2, '#e8caa0')
    box(d, x, 20, 1, 2, '#e8caa0')
# A wooden sailboat and blocks on the play rug.
d.polygon([(9, 13), (20, 13), (17, 16), (11, 16)], fill='#75382f')
box(d, 13, 7, 1, 7, '#30242a')
d.polygon([(14, 7), (14, 12), (18, 12)], fill='#fff0cd')
for x, y, base, top in [(27, 12, '#b75d45', '#e18f68'), (32, 10, '#7b4937', '#e6aa64'), (31, 15, '#2b534b', '#90a775')]:
    box(d, x, y, 4, 4, base)
    box(d, x, y, 4, 1, top)
save(rug, 'cabin-play-rug')

book, d = blank(28, 9)
for x in (0, 14):
    d.polygon([(x+1, 2), (x+6, 3), (x+12, 2), (x+12, 7), (x+6, 8), (x+1, 7)], fill=ink)
    d.polygon([(x+2, 1), (x+6, 2), (x+11, 1), (x+11, 6), (x+6, 7), (x+2, 6)], fill=cream)
    box(d, x+6, 3, 1, 4, trim)
    box(d, x+8, 3, 3, 1, trim)
d.polygon([(20, 2), (24, 0), (24, 4), (20, 7)], fill='#e8caa0')
save(book, 'cabin-reading-book')

pier, d = blank(32, 44)
box(d, 1, 4, 30, 40, '#28484a')
box(d, 3, 0, 26, 42, shade)
for y in range(1, 40, 5):
    box(d, 4, y, 24, 4, wood)
    box(d, 4, y, 24, 1, honey)
    box(d, 9 + y % 6, y + 2, 8, 1, '#ab7148')
for x in (1, 26):
    for y in (9, 24, 38):
        box(d, x, y, 5, 6, shade)
        box(d, x, y, 5, 2, honey)
save(pier, 'pier')

sign, d = blank(20, 20)
box(d, 3, 6, 3, 14, shade)
box(d, 14, 6, 3, 14, shade)
box(d, 1, 1, 18, 13, shade)
box(d, 2, 2, 16, 11, honey)
box(d, 4, 3, 12, 8, cream)
box(d, 5, 4, 10, 4, '#cead7b')
box(d, 5, 8, 10, 2, '#687b69')
box(d, 7, 6, 4, 2, shade)
save(sign, 'shore-sign')

def boat(name, colors):
    im, d = blank(48, 80)
    dark, mid, light = colors
    oval(d, 6, 12, 36, 60, '#244e58')
    hull = [(24, 3), (36, 17), (40, 47), (35, 68), (12, 68), (7, 47), (11, 17)]
    d.polygon(hull, fill=ink)
    d.polygon([(24,6),(34,19),(37,47),(33,65),(14,65),(10,47),(13,19)], fill=dark)
    d.polygon([(24,9),(32,22),(34,47),(30,62),(17,62),(13,47),(16,22)], fill=mid)
    d.line([(24,9),(16,22),(13,47),(17,62)], fill=light, width=2)
    for y in (27, 49):
        box(d, 15, y, 18, 5, shade)
        box(d, 15, y, 18, 2, honey)
    box(d, 21, 34, 6, 9, '#b19872')
    d.line([(28,35),(29,47),(26,59)], fill=cream)
    box(d, 19, 5, 4, 2, cream)
    save(im, name)

boat('boat-green', ('#2b534b', '#4f7963', '#90a775'))
boat('boat-red', ('#75382f', '#b75d45', '#e18f68'))
