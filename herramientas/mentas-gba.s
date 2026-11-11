@ ---------- Las mentas en Rojo Fuego / Verde Hoja ----------
@
@ Lo que hace una menta al usarla desde la Mochila (como el Caramelo Raro: elegir un Pokémon del equipo, la
@ animación del objeto y el mensaje). Se monta con herramientas/montar-mentas.py, que genera
@ js/randomizer/codigo-mentas-gba.js; js/randomizer/mentas-gba.js lo copia al espacio libre de la ROM y rellena las
@ palabras L_* con las direcciones de cada versión del juego (sacadas del código del Caramelo Raro).
@
@ Las funciones y nombres del juego, los del decomp de Rojo Fuego (github.com/pret/pokefirered):
@   campo(taskId)          la función de campo del objeto: gItemUseCB = usar1 y DoSetUpItemUseCallback(taskId)
@   usar1(taskId, func)    al elegir el Pokémon: si no hace nada (un huevo, ya tiene esa naturaleza o no hay PID que
@                          cuadre), «No tendrá ningún efecto»; si no, la animación del objeto y gItemUseCB = usar2
@   usar2(taskId, func)    tras la animación: el PID nuevo, las estadísticas, gastar la menta y el mensaje
@
@ La naturaleza es el PID % 25. Para cambiarla se busca otro PID con el mismo byte bajo (el género), si es shiny o
@ no igual que antes, la misma letra si es Unown y la misma evolución si es Wurmple; y como los cuatro trozos de
@ datos del Pokémon van barajados según el PID y cifrados con PID ^ ID del entrenador, se descifran con el viejo y
@ se vuelven a cifrar con el nuevo (la suma no cambia: es de los datos ya descifrados). La naturaleza de cada menta
@ va en el objeto (holdEffectParam, +19 de cada uno de 44 bytes).

    .thumb
    .syntax unified

@ ---- campo(u8 taskId) ----
campo:
    push {lr}
    ldr r2, L_gItemUseCB
    ldr r1, L_usar1
    str r1, [r2]
    ldr r3, L_DoSetUpItemUseCallback
    bl llamar
    pop {r0}
    bx r0

@ ---- usar1(u8 taskId, TaskFunc func) ----
usar1:
    push {r4-r7, lr}
    lsls r0, r0, #24
    lsrs r6, r0, #24
    mov r7, r1
    bl elPokemon
    mov r4, r0
    bl laNaturaleza
    mov r5, r0
    ldrb r0, [r4, #19]          @ huevo (bit 2) o huevo malo (bit 0)
    movs r1, #5
    tst r0, r1
    bne usar1_nada
    ldr r0, [r4]
    movs r1, #25
    bl resto
    cmp r0, r5
    beq usar1_nada
    mov r0, r4
    mov r1, r5
    bl buscar
    cmp r0, #0
    beq usar1_nada
    movs r0, #5                 @ SE_SELECT
    ldr r3, L_PlaySE
    bl llamar
    mov r0, r6
    ldr r3, L_Task_DoUseItemAnim
    bl llamar
    ldr r2, L_gItemUseCB
    ldr r1, L_usar2
    str r1, [r2]
    b usar1_fin
usar1_nada:
    movs r0, #5                 @ SE_SELECT
    ldr r3, L_PlaySE
    bl llamar
    mov r0, r6
    mov r1, r7
    bl sinEfecto
usar1_fin:
    pop {r4-r7}
    pop {r0}
    bx r0

@ ---- usar2(u8 taskId, TaskFunc func) ----
usar2:
    push {r4-r7, lr}
    lsls r0, r0, #24
    lsrs r6, r0, #24
    mov r7, r1
    bl elPokemon
    mov r4, r0
    bl laNaturaleza
    mov r5, r0
    mov r0, r4
    mov r1, r5
    bl buscar
    cmp r0, #0
    bne usar2_vale
    mov r0, r6
    mov r1, r7
    bl sinEfecto
    b usar2_fin
usar2_vale:
    mov r0, r4                  @ r1: el PID nuevo
    bl cambiar
    mov r0, r4
    ldr r3, L_CalculateMonStats
    bl llamar
    ldr r1, L_gPartyMenuUseExitCallback
    movs r0, #1
    strb r0, [r1]
    movs r0, #1                 @ SE_USE_ITEM
    ldr r3, L_PlaySE
    bl llamar
    ldr r0, L_gSpecialVar_ItemId
    ldrh r0, [r0]
    movs r1, #1
    ldr r3, L_RemoveBagItem
    bl llamar
    mov r0, r4
    ldr r1, L_gStringVar1
    ldr r3, L_GetMonNickname
    bl llamar
    ldr r1, L_mensajes          @ el de esta naturaleza
    lsls r0, r5, #2
    ldr r1, [r1, r0]
    ldr r0, L_gStringVar4
    ldr r3, L_StringExpandPlaceholders
    bl llamar
    ldr r0, L_gStringVar4
    movs r1, #1
    ldr r3, L_DisplayPartyMenuMessage
    bl llamar
    movs r0, #2
    ldr r3, L_ScheduleBgCopyTilemapToVram
    bl llamar
    mov r0, r6
    mov r1, r7
    bl ponerTarea
usar2_fin:
    pop {r4-r7}
    pop {r0}
    bx r0

@ ---- sinEfecto(taskId, func): «No tendrá ningún efecto» ----
sinEfecto:
    push {r4, r5, lr}
    mov r4, r0
    mov r5, r1
    ldr r1, L_gPartyMenuUseExitCallback
    movs r0, #0
    strb r0, [r1]
    ldr r0, L_gText_WontHaveEffect
    movs r1, #1
    ldr r3, L_DisplayPartyMenuMessage
    bl llamar
    movs r0, #2
    ldr r3, L_ScheduleBgCopyTilemapToVram
    bl llamar
    mov r0, r4
    mov r1, r5
    bl ponerTarea
    pop {r4, r5}
    pop {r0}
    bx r0

@ ---- ponerTarea(taskId, func): gTasks[taskId].func = func (cada tarea, 40 bytes) ----
ponerTarea:
    ldr r2, L_gTasks
    lsls r3, r0, #2
    adds r3, r3, r0
    lsls r3, r3, #3
    adds r3, r3, r2
    str r1, [r3]
    bx lr

@ ---- elPokemon() -> &gPlayerParty[gPartyMenu.slotId] (100 bytes cada uno) ----
elPokemon:
    ldr r0, L_gPartyMenu
    movs r1, #9
    ldrsb r1, [r0, r1]
    movs r0, #100
    muls r1, r0, r1
    ldr r0, L_gPlayerParty
    adds r0, r0, r1
    bx lr

@ ---- laNaturaleza() -> la de la menta que se usa (gItems[gSpecialVar_ItemId].holdEffectParam) ----
laNaturaleza:
    ldr r0, L_gSpecialVar_ItemId
    ldrh r0, [r0]
    movs r1, #44
    muls r0, r1, r0
    ldr r1, L_naturalezas
    ldrb r0, [r1, r0]
    bx lr

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

@ ---- valorShiny(pid, otId) -> TID ^ SID ^ PID alto ^ PID bajo (shiny si es menor que 8) ----
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

@ ---- letra(pid) -> la letra de Unown ----
letra:
    push {lr}
    lsrs r1, r0, #24
    lsls r1, r1, #30
    lsrs r1, r1, #24
    lsrs r2, r0, #16
    lsls r2, r2, #30
    lsrs r2, r2, #26
    orrs r1, r2
    lsrs r2, r0, #8
    lsls r2, r2, #30
    lsrs r2, r2, #28
    orrs r1, r2
    lsls r2, r0, #30
    lsrs r2, r2, #30
    orrs r1, r2
    mov r0, r1
    movs r1, #28
    bl resto
    pop {r1}
    bx r1

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
    mov r0, r1
    pop {r1}
    bx r1

@ ---- buscar(mon, naturaleza) -> r0 = 1 si hay PID (r1, el PID) ----
@ Prueba 65536 PID: el byte bajo, el de antes; el siguiente, i & 0xFF; los 16 de arriba, los de antes ^ (lo que
@ cambian los de abajo) ^ (i >> 8). Pila: 0 i, 4 valor shiny de antes, 8 especie, 12 PID que se prueba,
@ 16 letra de antes, 20 Silcoon de antes
buscar:
    push {r4-r7, lr}
    sub sp, #24
    mov r4, r0
    mov r5, r1
    ldr r6, [r4]
    ldr r7, [r4, #4]
    movs r1, #11                @ MON_DATA_SPECIES
    movs r2, #0
    ldr r3, L_GetMonData
    bl llamar
    str r0, [sp, #8]
    mov r0, r6
    bl letra
    str r0, [sp, #16]
    mov r0, r6
    bl silcoon
    str r0, [sp, #20]
    mov r0, r6
    mov r1, r7
    bl valorShiny
    str r0, [sp, #4]
    movs r0, #0
    str r0, [sp, #0]
buscar_otro:
    ldr r0, [sp, #0]
    lsls r1, r0, #24
    lsrs r1, r1, #16            @ (i & 0xFF) << 8
    lsls r2, r6, #24
    lsrs r2, r2, #24            @ el byte bajo de antes
    orrs r1, r2                 @ los 16 de abajo, nuevos
    lsls r2, r6, #16
    lsrs r2, r2, #16            @ los 16 de abajo, de antes
    eors r2, r1
    lsrs r3, r6, #16
    eors r2, r3
    lsrs r3, r0, #8
    eors r2, r3                 @ los 16 de arriba, nuevos
    lsls r2, r2, #16
    orrs r1, r2
    str r1, [sp, #12]
    mov r0, r1
    movs r1, #25
    bl resto
    cmp r0, r5
    bne buscar_sigue
    ldr r0, [sp, #12]
    mov r1, r7
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
    cmp r0, #201                @ Unown
    bne buscar_noUnown
    ldr r0, [sp, #12]
    bl letra
    ldr r1, [sp, #16]
    cmp r0, r1
    bne buscar_sigue
buscar_noUnown:
    ldr r0, [sp, #8]
    ldr r1, L_wurmple
    cmp r0, r1
    bne buscar_vale
    ldr r0, [sp, #12]
    bl silcoon
    ldr r1, [sp, #20]
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
    mov r1, r6
buscar_fin:
    add sp, #24
    pop {r4-r7}
    pop {r2}
    bx r2

@ ---- cambiar(mon, pid): descifra con el PID viejo, pone el nuevo y cifra con él ----
cambiar:
    push {r4, r5, lr}
    sub sp, #48
    mov r4, r0
    mov r5, r1
    ldr r2, [r4]
    mov r1, sp
    movs r3, #0
    bl trozos
    str r5, [r4]
    mov r0, r4
    mov r1, sp
    mov r2, r5
    movs r3, #1
    bl trozos
    add sp, #48
    pop {r4, r5}
    pop {r0}
    bx r0

@ ---- trozos(mon, buffer, pid, sentido): sentido 0, de mon al buffer (G, A, E, M en orden y descifrados); 1, al revés
trozos:
    push {r4-r7, lr}
    mov r4, r0
    mov r5, r1
    mov r6, r3
    ldr r7, [r4, #4]
    eors r7, r2                 @ la llave: PID ^ ID del entrenador
    mov r0, r2
    movs r1, #24
    bl resto
    lsls r0, r0, #2
    ldr r1, L_orden
    adds r1, r1, r0
    mov r12, r1                 @ dónde va cada trozo con este PID
    movs r3, #0
trozos_uno:
    mov r1, r12
    ldrb r1, [r1, r3]
    movs r0, #12
    muls r1, r0, r1
    adds r1, #32
    adds r1, r4, r1             @ el trozo en el Pokémon
    movs r0, #12
    muls r0, r3, r0
    adds r0, r5, r0             @ el trozo en el buffer
    cmp r6, #0
    bne trozos_copia
    mov r2, r0                  @ de mon al buffer: al revés
    mov r0, r1
    mov r1, r2
trozos_copia:
    ldr r2, [r0, #0]
    eors r2, r7
    str r2, [r1, #0]
    ldr r2, [r0, #4]
    eors r2, r7
    str r2, [r1, #4]
    ldr r2, [r0, #8]
    eors r2, r7
    str r2, [r1, #8]
    adds r3, #1
    cmp r3, #4
    blo trozos_uno
    pop {r4-r7}
    pop {r0}
    bx r0

llamar:
    bx r3

@ ---- Dónde va cada trozo (G, A, E, M) según PID % 24 ----
    .align 2
tabla_orden:
    .byte 0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1
    .byte 1,0,2,3, 1,0,3,2, 2,0,1,3, 3,0,1,2, 2,0,3,1, 3,0,2,1
    .byte 1,2,0,3, 1,3,0,2, 2,1,0,3, 3,1,0,2, 2,3,0,1, 3,2,0,1
    .byte 1,2,3,0, 1,3,2,0, 2,1,3,0, 3,1,2,0, 2,3,1,0, 3,2,1,0

@ ---- Lo que se rellena al copiarlo a la ROM ----
    .align 2
L_gItemUseCB: .word 0
L_DoSetUpItemUseCallback: .word 0
L_usar1: .word 0
L_usar2: .word 0
L_PlaySE: .word 0
L_Task_DoUseItemAnim: .word 0
L_CalculateMonStats: .word 0
L_gPartyMenuUseExitCallback: .word 0
L_gSpecialVar_ItemId: .word 0
L_RemoveBagItem: .word 0
L_gStringVar1: .word 0
L_GetMonNickname: .word 0
L_mensajes: .word 0
L_gStringVar4: .word 0
L_StringExpandPlaceholders: .word 0
L_DisplayPartyMenuMessage: .word 0
L_ScheduleBgCopyTilemapToVram: .word 0
L_gText_WontHaveEffect: .word 0
L_gTasks: .word 0
L_gPartyMenu: .word 0
L_gPlayerParty: .word 0
L_naturalezas: .word 0
L_GetMonData: .word 0
L_wurmple: .word 0
L_orden: .word 0
