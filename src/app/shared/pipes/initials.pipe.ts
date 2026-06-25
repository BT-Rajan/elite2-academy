import { Pipe, PipeTransform } from '@angular/core';
import { initials } from '../../core/utils';

@Pipe({ name: 'initials', standalone: true })
export class InitialsPipe implements PipeTransform {
  transform(value: string): string { return initials(value); }
}
