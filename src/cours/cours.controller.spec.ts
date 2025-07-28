import { Test, TestingModule } from '@nestjs/testing';
import { CoursController } from './cours.controller';

describe('CoursController', () => {
  let controller: CoursController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursController],
    }).compile();

    controller = module.get<CoursController>(CoursController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
