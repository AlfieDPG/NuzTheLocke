@ ---------- Las mentas en la 4.ª generación (Diamante, Perla, Platino, HeartGold, SoulSilver) ----------
@
@ Lo mismo que herramientas/mentas-gba.s, para los de DS. Se monta con herramientas/montar-mentas.py (genera
@ js/randomizer/codigo-mentas-gen4.js) y js/randomizer/mentas-gen4.js lo copia al final de la ITCM (la memoria
@ rápida del ARM9, que el juego casi no usa) y rellena las palabras L_* con las direcciones de cada juego y versión.
@
@ Nombres del decomp de Platino (github.com/pret/pokeplatinum). En el menú del equipo, al usar un objeto
@ (ApplyItemEffectOnPokemon), se cambian dos llamadas para que pasen antes por aquí:
@   comprobar   en lugar de Party_CheckItemEffectsOnMember(party, objeto, hueco, ataque, [sp] heap): si es una menta,
@               1 si hace algo (no es un huevo, no tiene ya esa naturaleza y hay un PID que cuadre); si no, la de
@               siempre (se salta a ella con la pila tal cual)
@   elegir      en lugar de PartyMenu_SetItemUseCallback(app): si es una menta, el paso siguiente es «usar»
@   usar        el paso del menú: el PID nuevo, las estadísticas, el mensaje («¡X tiene ahora naturaleza Y!», uno
@               por menta, añadidos al archivo de textos del menú) y el sonido; luego, esperar a que pulses
@ (Para entonces el juego ya ha quitado la menta de la bolsa.)
@
@ La naturaleza es el PID % 25. El PID nuevo: el mismo byte bajo (género y habilidad), shiny o no igual que antes
@ y, en Wurmple, la misma evolución. Los cuatro bloques de datos van barajados según (PID >> 13) % 24 y cifrados con
@ la suma (que no cambia); lo del equipo, con el PID: se descifra con Pokemon_EnterDecryptionContext, se reordenan
@ los bloques, se pone el PID y Pokemon_ExitDecryptionContext lo vuelve a cifrar con el nuevo.

    .thumb
    .syntax unified

@ ---- comprobar(party, objeto, hueco, ataque, [sp] heap) ----
comprobar:
    push {r0}
    movs r0, r1
    subs r0, #113               @ las mentas: del 113 al 133
    cmp r0, #21
    pop {r0}
    bhs comprobar_siempre
    push {r4, r5, lr}
    subs r5, r1, #0
    subs r5, #113               @ cuál
    movs r1, r2
    ldr r3, L_Party_GetPokemonBySlotIndex
    bl llamar
    movs r4, r0
    ldr r0, L_naturalezas
    ldrb r1, [r0, r5]
    movs r0, r4
    bl puede
    pop {r4, r5}
    pop {r1}
    bx r1
comprobar_siempre:
    push {r0}
    ldr r0, L_Party_CheckItemEffectsOnMember
    mov r12, r0
    pop {r0}
    bx r12

@ ---- elegir(app) ----
elegir:
    push {r4, lr}
    movs r4, r0
    bl laMenta
    cmp r0, #21
    bhs elegir_siempre
    ldr r1, L_app_callback
    ldr r2, L_usar
    str r2, [r4, r1]
    pop {r4}
    pop {r0}
    bx r0
elegir_siempre:
    movs r0, r4
    ldr r3, L_PartyMenu_SetItemUseCallback
    bl llamar
    pop {r4}
    pop {r0}
    bx r0

@ ---- usar(app) -> el estado del menú (5: seguir con el paso que toca) ----
usar:
    push {r4-r7, lr}
    movs r4, r0
    bl laMenta
    movs r6, r0                 @ cuál
    ldr r0, L_naturalezas
    ldrb r5, [r0, r6]           @ la naturaleza
    ldr r1, L_app_partyMenu
    ldr r0, [r4, r1]
    ldr r0, [r0]                @ partyMenu->party
    ldr r1, L_app_slot
    ldrb r1, [r4, r1]
    ldr r3, L_Party_GetPokemonBySlotIndex
    bl llamar
    movs r7, r0                 @ el Pokémon
    movs r1, r5
    bl buscar
    cmp r0, #0
    beq usar_mensaje            @ no debería pasar (ya se comprobó): sin cambiar nada
    movs r0, r7
    bl cambiar
    movs r0, r7
    ldr r3, L_Pokemon_CalcLevelAndStats
    bl llamar
usar_mensaje:
    movs r0, r7
    ldr r3, L_Pokemon_GetBoxPokemon
    bl llamar
    movs r2, r0
    ldr r1, L_app_template
    ldr r0, [r4, r1]
    movs r1, #0
    ldr r3, L_StringTemplate_SetNickname
    bl llamar
    ldr r1, L_app_messageLoader
    ldr r0, [r4, r1]
    ldr r1, L_primerMensaje
    adds r1, r1, r6
    ldr r3, L_MessageLoader_GetNewString
    bl llamar
    movs r5, r0                 @ el texto con el mote por poner
    ldr r1, L_app_template
    ldr r0, [r4, r1]
    ldr r1, L_app_tmpString
    ldr r1, [r4, r1]
    movs r2, r5
    ldr r3, L_StringTemplate_Format
    bl llamar
    movs r0, r5
    ldr r3, L_String_Free
    bl llamar
    movs r0, r4
    movs r1, #0
    mvns r1, r1                 @ el que se acaba de preparar
    movs r2, #1
    ldr r3, L_PartyMenu_PrintLongMessage
    bl llamar
    ldr r0, L_sonido
    ldr r3, L_Sound_PlayEffect
    bl llamar
    ldr r1, L_app_callback
    ldr r2, L_PartyMenuCB_PrintThenWaitABPress
    str r2, [r4, r1]
    movs r0, #5
    pop {r4-r7}
    pop {r1}
    bx r1

@ ---- laMenta(app) -> cuál es (0-20), o 21 o más si el objeto no es una menta ----
laMenta:
    ldr r1, L_app_partyMenu
    ldr r0, [r0, r1]
    ldr r1, L_pm_usedItemID
    ldrh r0, [r0, r1]
    subs r0, #113
    bhs laMenta_fin
    movs r0, #255
laMenta_fin:
    bx lr

@ ---- puede(mon, naturaleza) -> 1 si la menta hace algo ----
puede:
    push {r4, r5, lr}
    movs r4, r0
    movs r5, r1
    movs r1, #76                @ MON_DATA_IS_EGG
    movs r2, #0
    ldr r3, L_Pokemon_GetValue
    bl llamar
    cmp r0, #0
    bne puede_no
    ldr r0, [r4]
    movs r1, #25
    bl resto
    cmp r0, r5
    beq puede_no
    movs r0, r4
    movs r1, r5
    bl buscar
    b puede_fin
puede_no:
    movs r0, #0
puede_fin:
    pop {r4, r5}
    pop {r1}
    bx r1

@ ---- resto(n, d) -> n % d, sin signo (d < 2^31; usa r2 y r3) ----
resto:
    mov r2, r1
    lsrs r3, r0, #1
resto_sube:
    cmp r2, r3
    bhi resto_baja
    lsls r2, r2, #1
    b resto_sube
resto_baja:
    cmp r0, r2
    blo resto_sigue
    subs r0, r0, r2
resto_sigue:
    cmp r2, r1
    beq resto_fin
    lsrs r2, r2, #1
    b resto_baja
resto_fin:
    bx lr

@ ---- valorShiny(pid, otId) -> TID ^ SID ^ PID alto ^ PID bajo ----
valorShiny:
    lsrs r2, r1, #16
    lsls r1, r1, #16
    lsrs r1, r1, #16
    eors r1, r2
    lsrs r2, r0, #16
    eors r1, r2
    lsls r0, r0, #16
    lsrs r0, r0, #16
    eors r0, r1
    bx lr

@ ---- silcoon(pid) -> 1 si Wurmple evoluciona a Silcoon ((PID >> 16) % 10 <= 4) ----
silcoon:
    push {lr}
    lsrs r0, r0, #16
    movs r1, #10
    bl resto
    movs r1, #1
    cmp r0, #4
    bls silcoon_fin
    movs r1, #0
silcoon_fin:
    movs r0, r1
    pop {r1}
    bx r1

@ ---- buscar(mon, naturaleza) -> r0 = 1 si hay PID (r1, el PID) ----
@ Pila: 0 i, 4 valor shiny de antes, 8 especie, 12 PID que se prueba, 16 Silcoon de antes
buscar:
    push {r4-r7, lr}
    sub sp, #24
    movs r4, r0
    movs r5, r1
    ldr r6, [r4]
    movs r0, r4
    movs r1, #7                 @ MON_DATA_OT_ID
    movs r2, #0
    ldr r3, L_Pokemon_GetValue
    bl llamar
    movs r7, r0
    movs r0, r4
    movs r1, #5                 @ MON_DATA_SPECIES
    movs r2, #0
    ldr r3, L_Pokemon_GetValue
    bl llamar
    str r0, [sp, #8]
    movs r0, r6
    bl silcoon
    str r0, [sp, #16]
    movs r0, r6
    movs r1, r7
    bl valorShiny
    str r0, [sp, #4]
    movs r0, #0
    str r0, [sp, #0]
buscar_otro:
    ldr r0, [sp, #0]
    lsls r1, r0, #24
    lsrs r1, r1, #16
    lsls r2, r6, #24
    lsrs r2, r2, #24
    orrs r1, r2
    lsls r2, r6, #16
    lsrs r2, r2, #16
    eors r2, r1
    lsrs r3, r6, #16
    eors r2, r3
    lsrs r3, r0, #8
    eors r2, r3
    lsls r2, r2, #16
    orrs r1, r2
    str r1, [sp, #12]
    movs r0, r1
    movs r1, #25
    bl resto
    cmp r0, r5
    bne buscar_sigue
    ldr r0, [sp, #12]
    movs r1, r7
    bl valorShiny
    ldr r1, [sp, #4]
    movs r2, #0
    cmp r0, #8
    bhs buscar_s1
    movs r2, #1
buscar_s1:
    movs r3, #0
    cmp r1, #8
    bhs buscar_s2
    movs r3, #1
buscar_s2:
    cmp r2, r3
    bne buscar_sigue
    ldr r0, [sp, #8]
    ldr r1, L_wurmple
    cmp r0, r1
    bne buscar_vale
    ldr r0, [sp, #12]
    bl silcoon
    ldr r1, [sp, #16]
    cmp r0, r1
    bne buscar_sigue
buscar_vale:
    movs r0, #1
    ldr r1, [sp, #12]
    b buscar_fin
buscar_sigue:
    ldr r0, [sp, #0]
    adds r0, #1
    str r0, [sp, #0]
    lsrs r1, r0, #16
    bne buscar_nada
    b buscar_otro
buscar_nada:
    movs r0, #0
    movs r1, r6
buscar_fin:
    add sp, #24
    pop {r4-r7}
    pop {r2}
    bx r2

@ ---- cambiar(mon, pid) ----
@ Descifrado, los bloques (A, B, C, D, de 32 bytes desde +8) se copian en orden a la pila con el PID viejo y se
@ vuelven a poner con el nuevo
cambiar:
    push {r4-r7, lr}
    sub sp, #128
    movs r4, r0
    movs r5, r1
    ldr r3, L_Pokemon_EnterDecryptionContext
    bl llamar
    movs r6, r0                 @ si hay que volver a cifrar
    ldr r0, [r4]
    movs r1, #0                 @ del Pokémon a la pila
    bl bloques
    str r5, [r4]
    movs r0, r5
    movs r1, #1                 @ de la pila al Pokémon
    bl bloques
    movs r0, r4
    movs r1, r6
    ldr r3, L_Pokemon_ExitDecryptionContext
    bl llamar
    add sp, #128
    pop {r4-r7}
    pop {r0}
    bx r0

@ bloques(pid, sentido): r4 = el Pokémon; la pila de cambiar, 4 bytes más arriba (el lr de esta)
bloques:
    push {r4-r7, lr}
    movs r6, r1
    lsrs r0, r0, #13
    movs r1, #31
    ands r0, r1
    cmp r0, #24
    blo bloques_fila
    subs r0, #24
bloques_fila:
    lsls r0, r0, #2
    ldr r1, L_orden
    adds r1, r1, r0
    mov r12, r1                 @ dónde va cada bloque
    add r5, sp, #20             @ la pila de cambiar (5 registros guardados aquí)
    movs r7, #0                 @ qué bloque
bloques_uno:
    mov r1, r12
    ldrb r1, [r1, r7]
    lsls r1, r1, #5
    adds r1, #8
    adds r1, r4, r1             @ en el Pokémon
    lsls r0, r7, #5
    adds r0, r5, r0             @ en la pila
    cmp r6, #0
    bne bloques_copia
    movs r2, r0                 @ del Pokémon a la pila: al revés
    movs r0, r1
    movs r1, r2
bloques_copia:
    movs r3, #8
bloques_palabra:
    ldr r2, [r0]
    str r2, [r1]
    adds r0, #4
    adds r1, #4
    subs r3, #1
    bne bloques_palabra
    adds r7, #1
    cmp r7, #4
    blo bloques_uno
    pop {r4-r7}
    pop {r0}
    bx r0

llamar:
    bx r3

@ ---- Dónde va cada bloque (A, B, C, D) según (PID >> 13) % 24 ----
    .align 2
tabla_orden:
    .byte 0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1
    .byte 1,0,2,3, 1,0,3,2, 2,0,1,3, 3,0,1,2, 2,0,3,1, 3,0,2,1
    .byte 1,2,0,3, 1,3,0,2, 2,1,0,3, 3,1,0,2, 2,3,0,1, 3,2,0,1
    .byte 1,2,3,0, 1,3,2,0, 2,1,3,0, 3,1,2,0, 2,3,1,0, 3,2,1,0

@ ---- La naturaleza de cada menta (del 113 al 133, en el orden de la web) ----
tabla_naturalezas:
    .byte 1,3,4,2,5,8,9,7,15,16,19,17,20,21,23,22,10,11,13,14,12

@ ---- Lo que se rellena al copiarlo a la ROM ----
    .align 2
L_Party_GetPokemonBySlotIndex: .word 0
L_Party_CheckItemEffectsOnMember: .word 0
L_PartyMenu_SetItemUseCallback: .word 0
L_Pokemon_CalcLevelAndStats: .word 0
L_Pokemon_GetBoxPokemon: .word 0
L_StringTemplate_SetNickname: .word 0
L_MessageLoader_GetNewString: .word 0
L_StringTemplate_Format: .word 0
L_String_Free: .word 0
L_PartyMenu_PrintLongMessage: .word 0
L_Sound_PlayEffect: .word 0
L_PartyMenuCB_PrintThenWaitABPress: .word 0
L_Pokemon_GetValue: .word 0
L_Pokemon_EnterDecryptionContext: .word 0
L_Pokemon_ExitDecryptionContext: .word 0
L_app_callback: .word 0
L_app_partyMenu: .word 0
L_app_slot: .word 0
L_app_template: .word 0
L_app_messageLoader: .word 0
L_app_tmpString: .word 0
L_pm_usedItemID: .word 0
L_primerMensaje: .word 0
L_sonido: .word 0
L_usar: .word 0
L_naturalezas: .word 0
L_orden: .word 0
L_wurmple: .word 0
