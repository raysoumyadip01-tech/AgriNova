from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Product, Shipment, User
from app.schemas import RoleUpdateRequest, UserResponse
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/api", tags=["Dashboard & RBAC"])


@router.get("/health")
def health_check():
    return {"status": "ok", "service": "SmartFoodChain AI Backend (FastAPI)", "phase": 5}


@router.get("/dashboard/overview")
def dashboard_overview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    products = db.query(Product).all()
    shipments = db.query(Shipment).all()
    total_inventory_kg = sum(p.quantity for p in products)
    at_risk_stock_kg = sum(p.quantity for p in products if p.risk_level in ("High", "Critical"))
    safe_stock_kg = total_inventory_kg - at_risk_stock_kg
    active_shipments = sum(1 for s in shipments if s.status not in ("Delivered", "Cancelled"))
    completed_shipments = sum(1 for s in shipments if s.status == "Delivered")
    estimated_value_inr = sum(p.quantity * p.price_per_unit for p in products)

    return {
        "user": UserResponse.model_validate(current_user),
        "metrics": {
            "total_users": db.query(User).count(),
            "total_products": len(products),
            "total_inventory_kg": round(total_inventory_kg),
            "safe_stock_kg": round(safe_stock_kg),
            "at_risk_stock_kg": round(at_risk_stock_kg),
            "total_shipments": len(shipments),
            "active_shipments": active_shipments,
            "completed_shipments": completed_shipments,
            "estimated_food_saved_kg": round(safe_stock_kg * 0.42),
            "estimated_value_inr": round(estimated_value_inr),
        },
        "phase": 5,
    }


@router.get("/rbac/farmer/summary")
def farmer_only_summary(current_user: User = Depends(require_roles(["farmer", "admin"]))):
    return {
        "access": "granted",
        "resource": "farmer_summary",
        "verified_role": current_user.role,
        "message": "Backend RBAC verified Farmer/Admin access.",
    }


@router.get("/rbac/supply-chain/summary")
def supply_chain_summary(
    current_user: User = Depends(require_roles(["transporter", "warehouse", "retailer", "admin"])),
):
    return {
        "access": "granted",
        "resource": "supply_chain_summary",
        "verified_role": current_user.role,
        "message": "Backend RBAC verified Commercial Supply Chain access.",
    }


@router.get("/rbac/admin/users", response_model=list[UserResponse])
def admin_list_users(
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserResponse.model_validate(u) for u in users]


@router.put("/rbac/admin/users/{user_id}/role", response_model=UserResponse)
def admin_update_user_role(
    user_id: str,
    payload: RoleUpdateRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")
    if target.id == current_user.id and payload.role != "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot demote their own active account.")

    target.role = payload.role
    if target.role not in ("farmer", "transporter"):
        target.language_preference = "en"
    db.commit()
    db.refresh(target)
    return UserResponse.model_validate(target)
