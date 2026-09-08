import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsDateString()
  startsAt: string;
}
