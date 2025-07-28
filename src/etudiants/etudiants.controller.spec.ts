import { Test, TestingModule } from '@nestjs/testing';
import { EtudiantsController } from './etudiants.controller';

describe('EtudiantsController', () => {
  let controller: EtudiantsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EtudiantsController],
    }).compile();

    controller = module.get<EtudiantsController>(EtudiantsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
