namespace chassis {

    export let smartSpinTurnTimeOut = 800; // Максимальное время умного поворота относительно центра в мм
    export let smartPivotTurnTimeOut = 1000; // Максимальное время умного поворота относительно колеса в мм
    export let smartTurnDeregTimeOut = 150; // Время дорегулирования в умном повороте

    export let smartTurnConditionErrDifference = 10; // Пороговое значения ошибки для регулятора умного поворота, что поворот выполнен
    export let smartTurnConditionRegDifference = 10; // Пороговое значение регулятора (мощности регулятора) умного поворота для определения выполненного поворота

    export let smartSpinTurnSpeed = 50; // Переменная для хранения скорости при повороте относительно центра оси
    export let smartSpinTurnKp = 0.25; // Переменная для хранения коэффицента пропорционального регулятора при повороте относительно центра оси
    export let smartSpinTurnKi = 0; // Переменная для хранения коэффицента интегорального регулятора при повороте относительно центра оси
    export let smartSpinTurnKd = 2; // Переменная для хранения коэффицента дифференциального регулятора при повороте относительно центра оси
    export let smartSpinTurnN = 0; // Переменная для хранения коэффицента фильтра дифференциального регулятора при повороте относительно центра оси

    export let smartPivotTurnSpeed = 50; // Переменная для хранения скорости при повороте относительно колеса
    export let smartPivotTurnKp = 0.4; // Переменная для хранения коэффицента пропорционального регулятора при повороте относительно колеса
    export let smartPivotTurnKi = 0; // Переменная для хранения коэффицента интегорального регулятора при повороте относительно колеса
    export let smartPivotTurnKd = 2; // Переменная для хранения коэффицента дифференциального регулятора при повороте относительно колеса
    export let smartPivotTurnN = 0; // Переменная для хранения коэффицента фильтра дифференциального регулятора при повороте относительно колеса

    export function SetSmartSpinTurnTimeOut(timeOut: number) {
        smartSpinTurnTimeOut = timeOut;
    }

    export function SetSmartPivotTurnTimeOut(timeOut: number) {
        smartPivotTurnTimeOut = timeOut;
    }

    export function SetSmartTurnDeregTimeOut(timeOut: number) {
        smartTurnDeregTimeOut = timeOut;
    }

    export function SetSmartTurnConditionErrDifference(maxErr: number) {
        smartTurnConditionErrDifference = maxErr;
    }

    export function SetSmartTurnConditionRegDifference(maxU: number) {
        smartTurnConditionRegDifference = maxU;
    }

    /**
     * Поворот относительно центра колёс c регулятором.
     * @param deg угол в градусах поворота в градусах, где положительное число - вправо, а отрицательное влево, eg: 90
     * @param speed максимальная скорость поворота, eg: 60
     * @param debug отладка на экран, eg: false
     */
    //% blockId="SmartSpinTurn"
    //% block="умный поворот на $deg|° с $speed|\\% относительно центра колёс||параметры = $params| отдалка $debug"
    //% expandableArgumentMode="toggle"
    //% inlineInputMode="inline"
    //% speed.shadow="motorSpeedPicker"
    //% debug.shadow="toggleOnOff"
    //% weight="99"
    //% group="Повороты с регулятором"
    export function SmartSpinTurn(deg: number, params?: custom.LineFollowInterface, debug: boolean = false) {
        if (params) {
            if (params.speed) smartSpinTurnSpeed = params.speed;
            if (params.Kp) smartSpinTurnKp = params.Kp;
            if (params.Ki) smartSpinTurnKi = params.Ki;
            if (params.Kd) smartSpinTurnKd = params.Kd;
            if (params.N) smartSpinTurnN = params.N;
        }

        let lMotEncPrev = CHASSIS_L_MOTOR.angle(); // Считываем значение с энкодера левого мотора перед стартом алгаритма
        let rMotEncPrev = CHASSIS_R_MOTOR.angle(); //Считываем значение с энкодера правого мотора перед стартом алгаритма
        let calcMotRot = Math.round(deg * WHEELS_W / WHEELS_D); // Расчёт угла поворота моторов для поворота

        automation.pid2.setGains(smartSpinTurnKp, smartSpinTurnKi, smartSpinTurnKd); // Установка коэффициентов ПИД регулятора
        automation.pid2.setDerivativeFilter(smartSpinTurnN); // Установить фильтр дифференциального регулятора
        automation.pid2.setControlSaturation(-100, 100); // Устанавливаем интервал ПИД регулятора
        automation.pid2.reset(); // Сброс ПИД регулятора

        let isTurned = false; // Флажок о повороте
        let prevTime = 0; // Переменная предыдущего времения для цикла регулирования
        let deregStartTime = 0; // Переменная для хранения времени старта таймера дорегулирования 
        let startTime = control.millis(); // Стартовое время алгоритма
        while (true) { // Цикл регулирования
            let currTime = control.millis(); // Текущее время
            let dt = currTime - prevTime; // Время выполнения итерации цикла
            prevTime = currTime; // Обновляем переменную предыдущего времени на текущее время для следующей итерации
            let lMotEnc = CHASSIS_L_MOTOR.angle() - lMotEncPrev; // Значение энкодера с левого мотора в текущий момент
            let rMotEnc = CHASSIS_R_MOTOR.angle() - rMotEncPrev; // Значение энкодера с правого мотора в текущий момент
            let errorL = calcMotRot - lMotEnc; // Ошибки регулирования левой стороны
            let errorR = calcMotRot - rMotEnc; // Ошибки регулирования правой стороны
            let error = errorL - errorR; // Расчитываем общую ошибку
            automation.pid2.setPoint(error); // Передаём ошибку регулятору
            let u = automation.pid2.compute(dt, 0); // Вычисляем и записываем значение с регулятора
            u = Math.constrain(u, -smartSpinTurnSpeed, smartSpinTurnSpeed); // Ограничение скорости
            if (!isTurned && Math.abs(error) <= smartTurnConditionErrDifference && Math.abs(u) <= smartTurnConditionRegDifference) { // Если почти повернулись до конца при маленькой ошибке и маленькой мощности регулятора
                isTurned = true; // Повернулись до нужного градуса
                deregStartTime = control.millis(); // Время старта таймер времени для дорегулирования
                music.playToneInBackground(587, 50); // Сигнал начале дорегулирования
            }
            if (isTurned && currTime - deregStartTime >= smartTurnDeregTimeOut || currTime - startTime >= smartSpinTurnTimeOut) break; // Дорегулируемся
            CHASSIS_L_MOTOR.run(u); CHASSIS_R_MOTOR.run(-u); // Передаём управляющее воздействие на моторы
            if (debug) { // Отладка
                brick.clearScreen();
                brick.showValue("calcMotRot", calcMotRot, 1);
                brick.showValue("lMotEnc", lMotEnc, 2);
                brick.showValue("rMotEnc", rMotEnc, 3);
                brick.showValue("errorL", errorL, 4);
                brick.showValue("errorR", errorR, 5);
                brick.showValue("error", error, 6);
                brick.showValue("u", u, 7);
                brick.showValue("dt", dt, 12);
            }
            control.pauseUntilTime(currTime, 10); // Ожидание выполнения цикла
        }
        music.playToneInBackground(622, 50); // Издаём сигнал завершения дорегулирования
        CHASSIS_L_MOTOR.setBrake(true); CHASSIS_R_MOTOR.setBrake(true); // Установка тормоз с удержанием на моторы
        CHASSIS_L_MOTOR.stop(); CHASSIS_R_MOTOR.stop(); // Остановка моторов
    }

    /**
     * Поворот относительно левого или правого колеса c регулятором.
     * @param deg угол в градусах поворота, где положительное число - вправо, а отрицательное влево, eg: 90
     * @param speed максимальная скорость поворота, eg: 60
     * @param wheelPivot относительно колеса, eg: WheelPivot.LeftWheel
     * @param debug отладка на экран, eg: false
     */
    //% blockId="SmartPivotTurn"
    //% block="умный поворот на $deg|° с $speed|\\% относительно $wheelPivot|колеса||параметры = $params| отладка %debug"
    //% block.loc.ru="умный поворот на $deg|° с $speed|\\% относительно $wheelPivot|колеса||параметры = $params| отладка %debug"
    //% expandableArgumentMode="toggle"
    //% inlineInputMode="inline"
    //% speed.shadow="motorSpeedPicker"
    //% debug.shadow="toggleOnOff"
    //% weight="98"
    //% group="Повороты с регулятором"
    export function SmartPivotTurn(deg: number, wheelPivot: WheelPivot, params?: custom.LineFollowInterface, debug: boolean = false) {
        if (params) {
            if (params.speed) smartPivotTurnSpeed = params.speed;
            if (params.Kp) smartPivotTurnKp = params.Kp;
            if (params.Ki) smartPivotTurnKi = params.Ki;
            if (params.Kd) smartPivotTurnKd = params.Kd;
            if (params.N) smartPivotTurnN = params.N;
        }

        CHASSIS_L_MOTOR.setBrake(true); CHASSIS_R_MOTOR.setBrake(true); // Установить жёсткий тормоз для моторов
        let motEncPrev = 0; // Инициализируем переменную хранения значения с энкодера мотора
        if (wheelPivot == WheelPivot.LeftWheel) { // Записываем текущее значение с энкодера нужного мотора и ставим тормоз нужному мотору
            CHASSIS_L_MOTOR.stop(); // Тормоз на мотор
            motEncPrev = CHASSIS_R_MOTOR.angle(); // Если вращаться нужно вокруг левого, тогда записываем с правого
        } else if (wheelPivot == WheelPivot.RightWheel) {
            CHASSIS_R_MOTOR.stop(); // Тормоз на мотор
            motEncPrev = CHASSIS_L_MOTOR.angle(); // Если вращаться нужно вокруг правого, тогда записываем с левого
        }
        let calcMotRot = Math.round(((deg * WHEELS_W) / WHEELS_D) * 2); // Рассчитываем сколько градусов вращать мотор
        
        automation.pid2.setGains(smartPivotTurnKp, smartPivotTurnKi, smartPivotTurnKd); // Устанавливаем коэффиценты ПИД регулятора
        automation.pid2.setDerivativeFilter(smartPivotTurnN); // Установить фильтр дифференциального регулятора
        automation.pid2.setControlSaturation(-100, 100); // Устанавливаем интервал ПИД регулятора
        automation.pid2.reset(); // Сбросить ПИД регулятора

        let motEnc = 0; // Переменная для хранения значения с энкодера
        let isTurned = false; // Флажок о повороте
        let deregStartTime = 0; // Переменная для хранения времени старта таймера дорегулирования 
        let prevTime = 0; // Переменная предыдущего времения для цикла регулирования
        let startTime = control.millis(); // Стартовое время алгоритма
        while (true) { // Цикл регулирования
            let currTime = control.millis(); // Текущее время
            let dt = currTime - prevTime; // Время выполнения итерации цикла
            prevTime = currTime; // Обновляем переменную предыдущего времени на текущее время для следующей итерации
            if (wheelPivot == WheelPivot.LeftWheel) motEnc = CHASSIS_L_MOTOR.angle() - motEncPrev; // Значение левого энкодера мотора в текущий момент
            else if (wheelPivot == WheelPivot.RightWheel) motEnc = CHASSIS_R_MOTOR.angle() - motEncPrev; // Значение правого энкодера мотора в текущий момент
            let error = calcMotRot - motEnc; // Ошибка регулирования
            if (isTurned && currTime - deregStartTime >= smartTurnDeregTimeOut || currTime - startTime >= smartPivotTurnTimeOut) break; // Дорегулируемся
            automation.pid2.setPoint(error); // Передаём ошибку регулятору
            let U = automation.pid2.compute(dt, 0); // Записываем в переменную управляющее воздействие регулятора
            U = Math.constrain(U, -smartPivotTurnSpeed, smartPivotTurnSpeed); // Ограничить скорость по входному параметру
            if (!isTurned && Math.abs(error) <= smartTurnConditionErrDifference && Math.abs(U) <= smartTurnConditionRegDifference) { // Если почти повернулись до конца
                isTurned = true; // Повернулись до нужного градуса
                deregStartTime = control.millis(); // Время старта таймер времени для дорегулирования
                music.playToneInBackground(587, 50); // Сигнал начале дорегулирования
            }
            if (wheelPivot == WheelPivot.LeftWheel) CHASSIS_L_MOTOR.run(U); // Передаём правому мотору управляющее воздействие
            else if (wheelPivot == WheelPivot.RightWheel) CHASSIS_R_MOTOR.run(U); // Передаём левому мотору управляющее воздействие
            if (debug) { // Выводим для отладки на экран
                brick.clearScreen();
                brick.showValue("calcMotRot", calcMotRot, 1);
                brick.showValue("motEnc", motEnc, 2);
                brick.showValue("error", error, 3);
                brick.showValue("U", U, 4);
                brick.showValue("dt", dt, 12);
            }
            control.pauseUntilTime(currTime, 10); // Ожидание выполнения цикла
        }
        music.playToneInBackground(622, 100); // Издаём сигнал завершения дорегулирования
        CHASSIS_L_MOTOR.stop(); CHASSIS_R_MOTOR.stop(); // Остановить моторы
    }

    /**
     * Поворот относительно центра колёс на угол в градусах.
     * @param deg угол градуса поворота, где положительное число - вправо, а отрицательное влево, eg: 90
     * @param speed скорость поворота, eg: 60
     */
    //% blockId="SpinTurn"
    //% block="поворот на $deg|° с $speed|\\% относительно центра колёс"
    //% block.loc.ru="поворот на $deg|° с $speed|\\% относительно центра колёс"
    //% inlineInputMode="inline"
    //% expandableArgumentMode="toggle"
    //% speed.shadow="motorSpeedPicker"
    //% weight="99"
    //% group="Обычные повороты"
    export function SpinTurn(deg: number, speed: number) {
        if (deg == 0 || speed == 0) {
            //CHASSIS_MOTORS.stop();
            chassis.ChassisStop(true);
            return;
        }
        // CHASSIS_MOTORS.setBrake(true); // Удерживать при тормозе
        // let calcMotRot = (deg * WHEELS_W) / WHEELS_D; // Расчёт значения угла для поворота
        // CHASSIS_MOTORS.tank(speed, -speed, calcMotRot, MoveUnit.Degrees);
        CHASSIS_L_MOTOR.pauseUntilReady(); CHASSIS_R_MOTOR.pauseUntilReady(); // Ждём выполнения моторами команды ?????
        CHASSIS_L_MOTOR.setBrake(true); CHASSIS_R_MOTOR.setBrake(true); // Удерживать при тормозе
        const calcMotRot = (deg * WHEELS_W) / WHEELS_D; // Расчитать градусы для поворота в градусы для мотора
        CHASSIS_L_MOTOR.setPauseOnRun(false); CHASSIS_R_MOTOR.setPauseOnRun(false); // Отключаем у моторов ожидание выполнения
        CHASSIS_L_MOTOR.run(speed, calcMotRot, MoveUnit.Degrees); // Передаём команду движения левый мотор
        CHASSIS_R_MOTOR.run(-speed, calcMotRot, MoveUnit.Degrees); // Передаём команду движения правый мотор
        CHASSIS_L_MOTOR.pauseUntilReady(); CHASSIS_R_MOTOR.pauseUntilReady(); // Ждём выполнения моторами команды
        CHASSIS_L_MOTOR.stop(); CHASSIS_R_MOTOR.stop(); // Остановить моторы для защиты, если будет calcMotRot = 0, то моторы будут вращаться бесконечно
        CHASSIS_L_MOTOR.setPauseOnRun(true); CHASSIS_R_MOTOR.setPauseOnRun(true); // Включаем у моторов ожидание выполнения
    }

    /**
     * Повороты относительно левого или правого колеса на угол в градусах.
     * @param deg угол в градусах для поворота, где положительное число - вправо, а отрицательное влево, eg: 90
     * @param speed скорость поворота, eg: 80
     * @param wheelPivot относительно колеса, eg: WheelPivot.LeftWheel
     */
    //% blockId="PivotTurn"
    //% block="turn to $deg|° with $speed|\\% relatively $wheelPivot| wheel"
    //% block.loc.ru="поворот на $deg|° с $speed|\\% относительно $wheelPivot| колеса"
    //% inlineInputMode="inline"
    //% expandableArgumentMode="toggle"
    //% speed.shadow="motorSpeedPicker"
    //% weight="98"
    //% group="Обычные повороты"
    export function PivotTurn(deg: number, speed: number, wheelPivot: WheelPivot) {
        if (deg == 0 || speed == 0) {
            //CHASSIS_MOTORS.stop();
            chassis.ChassisStop(true);
            return;
        }
        CHASSIS_L_MOTOR.pauseUntilReady(); CHASSIS_R_MOTOR.pauseUntilReady(); // Ждём выполнения моторами команды ??????
        // CHASSIS_MOTORS.setBrake(true); // Удерживать при тормозе
        CHASSIS_L_MOTOR.setBrake(true); CHASSIS_R_MOTOR.setBrake(true); // Удерживать при тормозе
        let calcMotRot = ((deg * WHEELS_W) / WHEELS_D) * 2; // Расчёт значения угла для поворота
        if (wheelPivot == WheelPivot.LeftWheel) {
            CHASSIS_L_MOTOR.stop(); // Остановить левый мотор
            CHASSIS_R_MOTOR.run(speed, calcMotRot, MoveUnit.Degrees);
        } else if (wheelPivot == WheelPivot.RightWheel) {
            CHASSIS_R_MOTOR.stop(); // Остановить правый мотор
            CHASSIS_L_MOTOR.run(speed, calcMotRot, MoveUnit.Degrees);
        }
    }
    
}