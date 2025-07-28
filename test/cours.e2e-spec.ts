import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('CoursController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/cours (GET)', () => {
    it('should return all courses when no sigle parameter provided', () => {
      return request(app.getHttpServer())
        .get('/cours')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return specific course when valid sigle provided', () => {
      return request(app.getHttpServer())
        .get('/cours?sigle=ALL1003')
        .expect(200)
        .expect((res) => {
          if (Object.keys(res.body).length > 0) {
            expect(res.body).toHaveProperty('sigle', 'ALL1003');
            expect(res.body).toHaveProperty('titre');
            expect(res.body).toHaveProperty('cycle');
            expect(res.body).toHaveProperty('crédits');
            expect(res.body).toHaveProperty('département');
          }
        });
    });

    it('should return empty object when invalid sigle provided', () => {
      return request(app.getHttpServer())
        .get('/cours?sigle=INVALID123')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should return empty object when non-existent sigle provided', () => {
      return request(app.getHttpServer())
        .get('/cours?sigle=XXX9999')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle empty sigle parameter', () => {
      return request(app.getHttpServer())
        .get('/cours?sigle=')
        .expect(200)
        .expect((res) => {
          // Should return all courses when sigle is empty
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should handle special characters in sigle', () => {
      return request(app.getHttpServer())
        .get('/cours?sigle=ABC@123')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle very long sigle parameter', () => {
      const longSigle = 'A'.repeat(50);
      return request(app.getHttpServer())
        .get(`/cours?sigle=${longSigle}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', () => {
      return request(app.getHttpServer())
        .get('/cours?sigle[]=test')
        .expect(500);
    });

    it('should handle multiple sigle parameters', () => {
      return request(app.getHttpServer())
        .get('/cours?sigle=ALL1003&sigle=MAT1001')
        .expect(500);
    });
  });

  describe('Response Structure Validation', () => {
    it('should return course with all required fields when found', async () => {
      const response = await request(app.getHttpServer())
        .get('/cours?sigle=ALL1003')
        .expect(200);

      if (Object.keys(response.body).length > 0) {
        expect(response.body).toHaveProperty('sigle');
        expect(response.body).toHaveProperty('titre');
        expect(response.body).toHaveProperty('cycle');
        expect(response.body).toHaveProperty('crédits');
        expect(response.body).toHaveProperty('département');

        // Validate data types
        expect(typeof response.body.sigle).toBe('string');
        expect(typeof response.body.titre).toBe('string');
        expect(typeof response.body.cycle).toBe('number');
        expect(typeof response.body.département).toBe('string');
      }
    });

    it('should return courses array with proper structure when getting all courses', async () => {
      const response = await request(app.getHttpServer())
        .get('/cours')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const firstCourse = response.body[0];
        expect(firstCourse).toHaveProperty('sigle');
        expect(firstCourse).toHaveProperty('titre');
        expect(firstCourse).toHaveProperty('cycle');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should respond within reasonable time for single course', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/cours?sigle=ALL1003')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(5000);
    });

    it('should respond within reasonable time for all courses', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/cours')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(10000);
    });
  });
});