import { IsInt, IsPositive } from 'class-validator';

export class CreateTicketDto {
  @IsInt()
  @IsPositive()
  total: number;
}
