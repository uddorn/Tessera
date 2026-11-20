import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC = 'tessera:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
