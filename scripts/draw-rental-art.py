"""Draw the fictional DirtBNB listings and the PC's Bramble Cay wallpaper."""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

art = Path(__file__).resolve().parents[1] / 'public' / 'art'
size = (192, 108)


def landscape(name, sky, cloud, ground, horizon, cabin, style, seed):
    rng = Random(seed)
    image = Image.new('RGB', size, sky)
    draw = ImageDraw.Draw(image)

    def polygon(points, color):
        draw.polygon(points, fill=color)

    def rect(x, y, w, h, color):
        draw.rectangle((x, y, x + w - 1, y + h - 1), fill=color)

    for x, y, width in [(12, 17, 37), (62, 12, 23), (118, 21, 51), (163, 9, 23)]:
        rect(x, y, width, 3, cloud)
        rect(x + 8, y - 2, max(6, width - 21), 2, cloud)
        rect(x - 6, y + 3, width - 9, 2, cloud)

    if style == 'desert':
        polygon([(0, 65), (28, 42), (49, 44), (64, 56), (92, 55), (128, 32), (148, 33),
                 (167, 49), (191, 45), (191, 108), (0, 108)], '#a75745')
        polygon([(0, 75), (33, 50), (50, 51), (66, 64), (117, 65), (137, 42), (153, 43),
                 (174, 58), (191, 54), (191, 108), (0, 108)], '#db8760')
        polygon([(0, 79), (56, 69), (106, 74), (156, 60), (191, 66), (191, 108), (0, 108)], ground)
    else:
        rect(0, 42, 192, 66, '#407e86' if style == 'dusk' else '#438d9a')
        for _ in range(105):
            x, y = rng.randrange(192), rng.randrange(43, 108)
            rect(x, y, rng.randrange(2, 16), 1, rng.choice(('#70b6ae', '#39727f', '#8ac8b8')))
        if style == 'hill':
            polygon([(0, 57), (18, 47), (40, 41), (56, 43), (80, 50),
                     (103, 56), (121, 74), (191, 90), (191, 108), (0, 108)], '#496953')
            polygon([(0, 65), (26, 52), (48, 48), (81, 57), (114, 71),
                     (130, 90), (191, 99), (191, 108), (0, 108)], ground)
        else:
            polygon([(0, 82), (26, 71), (49, 62), (77, 65), (108, 68), (130, 81), (166, 88),
                     (191, 89), (191, 108), (0, 108)], '#e7cb92' if style != 'dusk' else '#c99d77')
            polygon([(0, 90), (30, 76), (57, 70), (78, 72), (110, 74), (135, 88),
                     (170, 96), (191, 98), (191, 108), (0, 108)], ground)

    for _ in range(320):
        x, y = rng.randrange(192), rng.randrange(horizon, 108)
        if image.getpixel((x, y)) == ground:
            rect(x, y, rng.randrange(1, 5), 1, rng.choice(('#a29a62', '#707454', '#d8ae7d') if style == 'desert' else ('#689062', '#3d654f', '#a6a170')))

    x, y, wall, roof = cabin
    polygon([(x-3,y+28),(x+40,y+27),(x+51,y+34),(x+2,y+37)], '#424637')
    rect(x+3,y+11,36,19,'#554033')
    rect(x+5,y+12,30,15,wall)
    for line in (15, 19, 23):
        rect(x+6,y+line,28,1,'#9c6851')
    polygon([(x-2,y+13),(x+12,y),(x+33,y),(x+43,y+12),(x+41,y+14),(x+1,y+14)], '#403e3b')
    polygon([(x+2,y+11),(x+13,y+1),(x+32,y+1),(x+39,y+11)], roof)
    rect(x+8,y+10,28,2,'#b08461')
    rect(x+11,y+16,8,7,'#413d3d')
    rect(x+12,y+17,6,5,'#f0cf81')
    rect(x+15,y+17,1,5,wall)
    rect(x+25,y+16,7,13,'#594639')
    rect(x+27,y+17,4,10,'#897052')
    rect(x+26,y+28,9,2,'#d1aa77')
    for offset in (7, 32):
        rect(x+offset,y+28,2,5,'#634735')

    def foliage(tx, ty, scale):
        if style in ('lagoon', 'dusk'):
            polygon([(tx-2,ty),(tx+2,ty),(tx+scale//5+2,ty-scale),(tx+scale//5,ty-scale)], '#694c3b')
            tip_x, tip_y = tx+scale//5, ty-scale
            for dx, dy in [(-16,-3),(-11,-10),(7,-11),(17,-5),(13,4),(-13,6)]:
                polygon([(tip_x,tip_y-2),(tip_x+dx//2,tip_y+dy-3),(tip_x+dx,tip_y+dy+2),
                         (tip_x+dx//2,tip_y+dy+2),(tip_x,tip_y+3)], '#2b604c')
                draw.line((tip_x,tip_y,tip_x+dx//2,tip_y+dy), fill='#709266')
        else:
            rect(tx-1,ty-scale//2,3,scale//2,'#765440')
            count = 13 if style == 'hill' else 6
            for _ in range(count):
                xx, yy = tx+rng.randint(-scale//2,scale//2), ty-rng.randint(scale//4,scale)
                polygon([(xx-4,yy+2),(xx-3,yy-1),(xx+2,yy-2),(xx+5,yy+2),(xx+3,yy+4),(xx-4,yy+4)],
                        rng.choice(('#396652','#4d805a','#759262') if style == 'hill' else ('#606b49','#858854','#9a9563')))

    for tx, ty, scale in [(17, 101, 24), (44, 87, 15), (166, 99, 25), (185, 108, 19)]:
        foliage(tx, ty, scale)
    image.save(art / f'{name}.png')


landscape('rental-erub', '#a6c4bf', '#e8daba', '#628052', 52, (90, 47, '#d9aa7c', '#ad654d'), 'hill', 13)
landscape('rental-funafuti', '#8cc5c3', '#f1deb6', '#78905e', 63, (69, 48, '#e9bf87', '#548481'), 'lagoon', 25)
landscape('rental-alice-springs', '#d9a38a', '#efd0ac', '#ba8057', 66, (103, 51, '#d7a77c', '#80534b'), 'desert', 42)
landscape('pc-wallpaper', '#879398', '#e6b091', '#7b805a', 63, (111, 47, '#c6a080', '#576e66'), 'dusk', 56)
landscape('rental-erub-coast', '#a3c5bd', '#ead8b3', '#69885b', 63, (77, 48, '#d3a574', '#a55b4b'), 'lagoon', 117)
