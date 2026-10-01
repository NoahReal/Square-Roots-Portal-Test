from django.contrib import admin

from .models import Confirmation, LocationOrder, LocationOrderLine, OrderForm, OrderFormItem, PriceItem, PriceList, TransportCompany

admin.site.register([PriceList, PriceItem, OrderForm, OrderFormItem, LocationOrder, LocationOrderLine, TransportCompany, Confirmation])
