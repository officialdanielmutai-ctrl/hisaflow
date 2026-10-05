import { BadRequestException } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { ValidationPipe } from './validation.pipe';

class TestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

describe('ValidationPipe', () => {
  const pipe = new ValidationPipe();
  const meta = (metatype: any): any => ({ type: 'body', metatype, data: undefined });

  it('passes values through untouched for native types', async () => {
    await expect(pipe.transform('raw', meta(String))).resolves.toBe('raw');
    await expect(pipe.transform(42, meta(Number))).resolves.toBe(42);
    await expect(pipe.transform({ a: 1 }, meta(Object))).resolves.toEqual({ a: 1 });
  });

  it('passes values through when there is no metatype', async () => {
    const value = { a: 1 };
    await expect(pipe.transform(value, meta(undefined))).resolves.toBe(value);
  });

  it('returns a validated DTO instance for valid input', async () => {
    const result = await pipe.transform({ name: 'Jane' }, meta(TestDto));

    expect(result).toBeInstanceOf(TestDto);
    expect(result.name).toBe('Jane');
  });

  it('throws BadRequestException for invalid input', async () => {
    await expect(pipe.transform({ name: '' }, meta(TestDto))).rejects.toThrow(BadRequestException);
  });
});
