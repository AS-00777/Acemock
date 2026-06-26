import React, { useState } from 'react';

const MiniCalculator: React.FC = () => {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);

  const calculate = (left: number, right: number, op: string) => {
    if (op === '+') return left + right;
    if (op === '-') return left - right;
    if (op === '*') return left * right;
    return right === 0 ? NaN : left / right;
  };

  const digit = (value: string) => {
    if (replace || display === '0' || display === 'Error') {
      setDisplay(value === '.' ? '0.' : value);
      setReplace(false);
    } else if (!(value === '.' && display.includes('.'))) {
      setDisplay(display + value);
    }
  };

  const chooseOperator = (next: string) => {
    const current = Number(display);
    if (stored !== null && operator && !replace) {
      const result = calculate(stored, current, operator);
      setStored(result);
      setDisplay(Number.isFinite(result) ? String(result) : 'Error');
    } else {
      setStored(current);
    }
    setOperator(next);
    setReplace(true);
  };

  const equals = () => {
    if (stored === null || !operator) return;
    const result = calculate(stored, Number(display), operator);
    setDisplay(Number.isFinite(result) ? String(Number(result.toFixed(10))) : 'Error');
    setStored(null);
    setOperator(null);
    setReplace(true);
  };

  const clear = () => { setDisplay('0'); setStored(null); setOperator(null); setReplace(false); };
  const buttons = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+'];

  return (
    <aside className="w-full lg:w-64 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-4 shadow-xl lg:sticky lg:top-24 h-fit">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-sm text-slate-800 dark:text-neutral-100">Mini Calculator</h3>
        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">Numerical only</span>
      </div>
      <div className="bg-slate-950 text-white rounded-2xl px-4 py-3 text-right text-xl font-bold tabular-nums overflow-hidden mb-3" title={display}>{display}</div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={clear} className="col-span-2 rounded-xl py-2 bg-red-50 text-red-600 font-black">C</button>
        <button onClick={() => setDisplay(display.length > 1 ? display.slice(0, -1) : '0')} className="rounded-xl py-2 bg-slate-100 dark:bg-neutral-800 font-black">⌫</button>
        <button onClick={equals} className="rounded-xl py-2 bg-blue-600 text-white font-black">=</button>
        {buttons.map((button) => (
          <button
            key={button}
            onClick={() => button === '%' ? setDisplay(String(Number(display) / 100)) : ['+', '-', '*', '/'].includes(button) ? chooseOperator(button) : digit(button)}
            className={`rounded-xl py-2.5 font-black ${['+', '-', '*', '/'].includes(button) ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600' : 'bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200'}`}
          >{button}</button>
        ))}
      </div>
    </aside>
  );
};

export default MiniCalculator;
