@ ---------- Las mentas en la 5.ª generación (Negro, Blanco, Negro 2, Blanco 2) ----------
@
@ Como herramientas/mentas-gen4.s, para los de 5.ª. Se monta con herramientas/montar-mentas.py (genera
@ js/randomizer/codigo-mentas-gen5.js) y js/randomizer/mentas-gen5.js lo copia al final de la ITCM y rellena las
@ palabras L_* con las direcciones de cada juego y versión.
@
@ En 5.ª la naturaleza es un dato aparte (no sale del PID), así que basta con PokeParty_SetNature (nombres de
@ github.com/ds-pokemon-hacking/swan), que la cambia y recalcula las estadísticas. En el menú del equipo, al usar un
@ objeto en un Pokémon, el juego hace: comprobar si hace algo, preparar el mensaje según el tipo de objeto, aplicarlo,
@ redibujar la ficha, el sonido y quitarlo de la Bolsa. Se cambian esas tres llamadas para que pasen antes por aquí:
@   comprobar   (pp, objeto, ataque, heap): si es una menta, 1 si hace algo (no es un huevo ni tiene ya esa
@               naturaleza); si no, la de siempre. Se apunta qué menta es para «preparar»
@   preparar    (menú, 0): si viene de una menta, su mensaje («¡X tiene ahora la naturaleza Y!», uno por menta,
@               añadidos al archivo de textos del menú) con la función del menú que pone el mote; devuelve el tipo 0
@               (ninguno especial: la ficha se redibuja como con cualquier objeto). Si no, la de siempre
@   aplicar     (pp, objeto, ataque, sitio, [sp] heap): si es una menta, la naturaleza nueva; si no, la de siempre
@ (Las de siempre se llaman saltando a ellas con los registros y la pila tal cual.)

    .thumb
    .syntax unified

@ ---- comprobar(pp, objeto, ataque, heap) ----
comprobar:
    push {r0, r1}
    ldr r0, L_primeraMenta
    subs r0, r1, r0             @ cuál (0-20 si es una menta)
    cmp r0, #21
    blo comprobar_menta
    ldr r0, L_ultima
    movs r1, #255
    str r1, [r0]                @ ninguna
    pop {r0, r1}
    push {r0}
    ldr r0, L_comprobacion
    mov r12, r0
    pop {r0}
    bx r12
comprobar_menta:
    ldr r1, L_ultima
    str r0, [r1]
    pop {r0, r1}
    push {r4, r5, lr}
    movs r4, r0
    ldr r0, L_primeraMenta
    subs r5, r1, r0
    movs r0, r4
    movs r1, #0x4c              @ PF_IsEgg
    movs r2, #0
    ldr r3, L_GetParam
    bl llamar
    cmp r0, #0
    bne comprobar_no
    movs r0, r4
    movs r1, #0x70              @ PF_Nature
    movs r2, #0
    ldr r3, L_GetParam
    bl llamar
    ldr r1, L_naturalezas
    ldrb r1, [r1, r5]
    cmp r0, r1
    beq comprobar_no
    movs r0, #1
    b comprobar_fin
comprobar_no:
    movs r0, #0
comprobar_fin:
    pop {r4, r5}
    pop {r1}
    bx r1

@ ---- preparar(menú, r1) -> el tipo de objeto ----
preparar:
    push {r0, r1}
    ldr r0, L_ultima
    ldr r1, [r0]
    cmp r1, #21
    blo preparar_menta
    pop {r0, r1}
    push {r0}
    ldr r0, L_preparacion
    mov r12, r0
    pop {r0}
    bx r12
preparar_menta:
    movs r2, #255
    str r2, [r0]                @ ya usada
    ldr r2, L_primerMensaje
    adds r2, r2, r1
    pop {r0, r1}
    push {r4, lr}
    movs r1, r2
    ldr r3, L_mensaje
    bl llamar
    movs r0, #0
    pop {r4}
    pop {r1}
    bx r1

@ ---- aplicar(pp, objeto, ataque, sitio, [sp] heap) ----
aplicar:
    push {r0}
    ldr r0, L_primeraMenta
    subs r0, r1, r0
    cmp r0, #21
    pop {r0}
    blo aplicar_menta
    push {r0}
    ldr r0, L_aplicacion
    mov r12, r0
    pop {r0}
    bx r12
aplicar_menta:
    push {r4, lr}
    ldr r2, L_primeraMenta
    subs r1, r1, r2
    ldr r2, L_naturalezas
    ldrb r1, [r2, r1]
    ldr r3, L_SetNature
    bl llamar
    movs r0, #1
    pop {r4}
    pop {r1}
    bx r1

llamar:
    bx r3

@ ---- La naturaleza de cada menta (en el orden de sus números: Huraña, Firme, Pícara, Audaz, Osada, Agitada,
@ Floja, Plácida, Modesta, Afable, Alocada, Mansa, Serena, Amable, Cauta, Grosera, Miedosa, Activa, Alegre,
@ Ingenua y Seria) ----
tabla_naturalezas:
    .byte 1,3,4,2,5,8,9,7,15,16,19,17,20,21,23,22,10,11,13,14,12

@ ---- Qué menta se acaba de comprobar (255: ninguna) ----
    .align 2
variable_ultima:
    .word 255

@ ---- Lo que se rellena al copiarlo a la ROM ----
L_primeraMenta: .word 0
L_ultima: .word 0
L_naturalezas: .word 0
L_GetParam: .word 0
L_SetNature: .word 0
L_comprobacion: .word 0
L_preparacion: .word 0
L_aplicacion: .word 0
L_mensaje: .word 0
L_primerMensaje: .word 0
