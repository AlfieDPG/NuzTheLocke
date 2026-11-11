@ ---------- Las mentas en X e Y, Rubí Omega y Zafiro Alfa, y Sol y Luna ----------
@
@ Como herramientas/mentas-gen5.s, para la 3DS (ARM). Se monta con herramientas/montar-mentas.py (genera
@ js/randomizer/codigo-mentas-xy.js) y js/randomizer/mentas-xy.js lo copia al hueco libre del final del código del
@ módulo de la Bolsa (DllBag.cro), que es donde se usan los objetos en los Pokémon del equipo.
@
@ La Bolsa llama a tres funciones del programa (a través de sus trampolines, que el juego rellena al cargar el módulo):
@ comprobar si el objeto hace algo, clasificarlo (por su tipo elige qué hacer y qué mensaje poner) y aplicarlo. Sus
@ llamadas pasan antes por aquí:
@   comprobar   (pp, objeto, ataque, heap): si es una menta, 1 si hace algo (no es un huevo ni tiene ya esa
@               naturaleza); si no, la de siempre
@   clasificar  (datos del objeto, con su número en +0x24): si es una menta, el tipo 9 («cura el enamoramiento»: con él
@               la Bolsa suena, la aplica y pone el mensaje de su tipo, y ningún objeto de verdad lo tiene fuera de
@               combate); si no, la de siempre
@   aplicar     (pp, objeto, ataque, ..., [sp], [sp+4]): si es una menta, la naturaleza nueva (con la función del juego que
@               la cambia y recalcula las estadísticas); si no, la de siempre
@   mensaje     el caso 9 de la función que pone el mensaje según el tipo: como el de «se ha despertado», con el mensaje
@               de esta menta («¡X tiene ahora la naturaleza Y!», añadidos al archivo de textos de la Bolsa)
@ Las palabras L_* se rellenan con las direcciones del programa (fijas) y los saltos salto_* (a los trampolines y a la
@ función del mensaje, dentro del módulo) se ponen al copiarlo, cuando se sabe dónde va.
@
@ pp: el Pokémon (pml::pokepara::PokemonParam); en +0xc, sus datos (CoreParam), que es lo que piden EsHuevo y Naturaleza.

    .arm
    .syntax unified

@ ---- comprobar(pp, objeto, ataque, heap) ----
comprobar:
    sub ip, r1, #0x1f8
    sub ip, ip, #1              @ cuál (0-20 si es una menta)
    cmp ip, #21
salto_comprobar:
    bhs salto_comprobar
    push {r4, r5, lr}
    mov r5, ip
    ldr r4, [r0, #0xc]
    mov r0, r4
    ldr ip, L_EsHuevo
    blx ip
    cmp r0, #0
    movne r0, #0
    bne comprobar_fin
    mov r0, r4
    ldr ip, L_Naturaleza
    blx ip
    adr r1, tabla_naturalezas
    ldrb r1, [r1, r5]
    cmp r0, r1
    moveq r0, #0
    movne r0, #1
comprobar_fin:
    pop {r4, r5, pc}

@ ---- clasificar(datos del objeto) ----
clasificar:
    ldr ip, [r0, #0x24]
    sub ip, ip, #0x1f8
    sub ip, ip, #1
    cmp ip, #21
salto_clasificar:
    bhs salto_clasificar
    ldr r0, L_tipo
    bx lr

@ ---- aplicar(pp, objeto, ataque, ...) ----
aplicar:
    sub ip, r1, #0x1f8
    sub ip, ip, #1
    cmp ip, #21
salto_aplicar:
    bhs salto_aplicar
    push {r4, lr}
    adr r2, tabla_naturalezas
    ldrb r1, [r2, ip]
    ldr ip, L_CambiarNaturaleza
    blx ip
    mov r0, #1
    pop {r4, pc}

@ ---- mensaje: dentro de la función de los mensajes (r4: ella, r7: el Pokémon; en [sp + 0x1c], el r4 de quien la
@ llamó, la Bolsa, con el objeto en +0x4c) ----
mensaje:
    ldr r0, [sp, #0x1c]
    ldrh r1, [r0, #0x4c]
    sub r1, r1, #0x1f8
    sub r1, r1, #1
    ldr r5, L_primerMensaje
    add r5, r5, r1
    ldr r0, [r4, #8]
    mov r2, r7
    mov r1, #0
salto_mote:
    bl salto_mote
    ldr r0, [r4, #8]
    mov r1, #1
salto_texto:
    bl salto_texto
    mov r6, r0
    ldr r0, [r4, #8]
    mov r2, r5
    mov r1, r6
salto_formar:
    bl salto_formar
    ldr r0, [r4, #8]
    mov r1, r6
salto_poner:
    bl salto_poner
salto_fin:
    b salto_fin

@ ---- mensaje7: lo mismo en Sol y Luna, donde la función de los mensajes es otra (r9: los textos; r8: dónde se forma;
@ r7: el Pokémon; en [sp + 0x10], el r5 de quien la llamó: el objeto). r4 se puede usar: la función lo recupera al acabar ----
mensaje7:
    ldr r0, [sp, #0x10]
    lsl r0, r0, #16
    lsr r0, r0, #16
    sub r0, r0, #0x1f8
    sub r0, r0, #1
    ldr r4, L_primerMensaje
    add r4, r4, r0
    mov r2, r7
    mov r1, #0
    mov r0, r9
salto7_mote:
    bl salto7_mote
    mov r2, r4
    mov r1, r8
    mov r0, r9
salto7_formar:
    bl salto7_formar
salto7_fin:
    b salto7_fin

@ ---- La naturaleza de cada menta (en el orden de sus números, como en la web) ----
tabla_naturalezas:
    .byte 1,3,4,2,5,8,9,7,15,16,19,17,20,21,23,22,10,11,13,14,12

@ ---- Lo que se rellena al copiarlo a la ROM ----
    .align 2
L_EsHuevo: .word 0
L_Naturaleza: .word 0
L_CambiarNaturaleza: .word 0
L_primerMensaje: .word 0
L_tipo: .word 0
