# Monta los programas de las mentas (Thumb) y genera un módulo con sus bytes y dónde está cada cosa dentro de ellos
# (las funciones y las palabras L_* que se rellenan con las direcciones de cada versión):
#   herramientas/mentas-gba.s  -> js/randomizer/codigo-mentas-gba.js  (Rojo Fuego / Verde Hoja: ./mentas-gba.js)
#   herramientas/mentas-gen4.s -> js/randomizer/codigo-mentas-gen4.js (4.ª generación: ./mentas-gen4.js)
#   herramientas/mentas-gen5.s -> js/randomizer/codigo-mentas-gen5.js (5.ª generación: ./mentas-gen5.js)
#   herramientas/mentas-xy.s   -> js/randomizer/codigo-mentas-xy.js   (3DS, en ARM: ./mentas-xy.js)
#
#   pip install keystone-engine
#   python herramientas/montar-mentas.py

import re
from pathlib import Path
import keystone

AQUI = Path(__file__).resolve().parent
THUMB = keystone.Ks(keystone.KS_ARCH_ARM, keystone.KS_MODE_THUMB)
ARM = keystone.Ks(keystone.KS_ARCH_ARM, keystone.KS_MODE_ARM)

# fuente, salida, las funciones y tablas que hacen falta fuera (además de las palabras L_* y, en ARM, los saltos salto_*)
PROGRAMAS = [
    ("mentas-gba.s", "codigo-mentas-gba.js", ["campo", "usar1", "usar2", "tabla_orden"], THUMB),
    ("mentas-gen4.s", "codigo-mentas-gen4.js", ["comprobar", "elegir", "usar", "tabla_orden", "tabla_naturalezas"], THUMB),
    ("mentas-gen5.s", "codigo-mentas-gen5.js", ["comprobar", "preparar", "aplicar", "tabla_naturalezas", "variable_ultima"], THUMB),
    ("mentas-xy.s", "codigo-mentas-xy.js", ["comprobar", "clasificar", "aplicar", "mensaje", "mensaje7", "tabla_naturalezas"], ARM),
]

for nombre, destino, entradas, ks in PROGRAMAS:
    # (sin los comentarios: el ensamblador solo quiere ASCII)
    fuente = re.sub(r"@.*", "", (AQUI / nombre).read_text(encoding="utf8"))
    etiquetas = entradas + re.findall(r"^(salto\w+):", fuente, re.M) + re.findall(r"^(L_\w+):", fuente, re.M)
    # Se monta con una lista de sus direcciones al final (se quita después)
    con_lista = fuente + "\n    .align 2\nlista_de_etiquetas:\n" + "".join(f"    .word {e}\n" for e in etiquetas)
    codigo, _ = ks.asm(con_lista, 0)
    codigo = bytes(codigo)
    largo = len(codigo) - 4 * len(etiquetas)
    sitios = {e: int.from_bytes(codigo[largo + 4 * k: largo + 4 * k + 4], "little") for k, e in enumerate(etiquetas)}
    codigo = codigo[:largo]
    assert all(v < largo for v in sitios.values())
    assert all(codigo[sitios[e]:sitios[e] + 4] == b"\0\0\0\0" for e in etiquetas if e.startswith("L_"))
    lineas = ",\n".join(f"  {e}: {v}" for e, v in sitios.items())
    salida = (
        f"// Generado por herramientas/montar-mentas.py (no tocar a mano): el programa de las mentas (herramientas/{nombre}),\n"
        f"// ya montado. SITIOS: dónde está cada cosa dentro de CODIGO.\n\n"
        f'export const CODIGO = "{codigo.hex()}";\n\n'
        f"export const SITIOS = {{\n{lineas}\n}};\n"
    )
    (AQUI.parent / "js" / "randomizer" / destino).write_text(salida, encoding="utf8")
    print(f"{nombre}: {largo} bytes")
