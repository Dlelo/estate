import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'ksh', standalone: true })
export class KshCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 2): string {
    if (value == null) return 'KSh 0.00';
    return `KSh ${value.toLocaleString('en-KE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}`;
  }
}
