import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CategoryBudgetModal } from './category-budget-modal';
import { RemoteConfigService } from '../../../../core/services/remote-config.service';

describe('CategoryBudgetModal', () => {
  let fixture: ComponentFixture<CategoryBudgetModal>;
  let component: CategoryBudgetModal;
  let remoteConfig: RemoteConfigService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CategoryBudgetModal] }).compileComponents();
    remoteConfig = TestBed.inject(RemoteConfigService);
    fixture = TestBed.createComponent(CategoryBudgetModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title and initial selected category', () => {
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Configurar Topes Presupuestales');
    expect(component['selectedCategory']()).toBe('Mercado');
  });

  it('preloads initial category when set via input', async () => {
    fixture.componentRef.setInput('initialCategory', 'Transporte');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['selectedCategory']()).toBe('Transporte');
    expect(component['amount']()).toBe('800.000');
  });

  it('allows saving updated budget value', async () => {
    const spy = vi.spyOn(remoteConfig, 'setCategoryBudget').mockResolvedValue(undefined);

    component['selectedCategory'].set('Compras');
    component['amount'].set('1.500.000');

    await component['onSave']();

    expect(spy).toHaveBeenCalledWith('Compras', 1500000);
  });

  it('allows removing budget value', async () => {
    const spy = vi.spyOn(remoteConfig, 'setCategoryBudget').mockResolvedValue(undefined);

    component['selectedCategory'].set('Transporte');

    await component['onRemove']();

    expect(spy).toHaveBeenCalledWith('Transporte', null);
    expect(component['amount']()).toBe('');
  });
});
