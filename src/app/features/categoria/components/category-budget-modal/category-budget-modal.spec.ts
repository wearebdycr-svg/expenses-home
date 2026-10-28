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

  it('renders default title when no category is preselected', () => {
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Configurar Tope Mensual');
    expect(component['isCategoryFixed']()).toBe(false);
  });

  it('renders fixed category view and title when initialCategory is provided', async () => {
    fixture.componentRef.setInput('initialCategory', 'Transporte');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['isCategoryFixed']()).toBe(true);
    expect(component['currentCategory']()).toBe('Transporte');
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Tope: Transporte');
    expect(component['amount']()).toBe('800.000');
    expect(fixture.nativeElement.querySelector('.category-badge-chip').textContent).toContain('Transporte');
  });

  it('allows saving updated budget value and emits close', async () => {
    const spy = vi.spyOn(remoteConfig, 'setCategoryBudget').mockResolvedValue(undefined);
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    fixture.componentRef.setInput('initialCategory', 'Compras');
    fixture.detectChanges();
    await fixture.whenStable();

    component['amount'].set('1.500.000');

    await component['onSave']();

    expect(spy).toHaveBeenCalledWith('Compras', 1500000);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('allows removing budget value and emits close', async () => {
    const spy = vi.spyOn(remoteConfig, 'setCategoryBudget').mockResolvedValue(undefined);
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    fixture.componentRef.setInput('initialCategory', 'Transporte');
    fixture.detectChanges();
    await fixture.whenStable();

    await component['onRemove']();

    expect(spy).toHaveBeenCalledWith('Transporte', null);
    expect(closeSpy).toHaveBeenCalled();
  });
});
